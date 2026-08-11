"""Integration tests for ``POST /api/v1/cad/analyze-machining``.

The router is mounted on a bare FastAPI app rather than the full service app so
these tests do not require Celery, Redis or the OpenTelemetry stack.
"""

from __future__ import annotations

import io
import json

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.v1 import machining as machining_router
from app.machining import occ

from . import fixtures
from .conftest import requires_kernel

ENDPOINT = "/api/v1/cad/analyze-machining"


def _all_keys(node, seen=None):
    """Every dict key appearing anywhere in a nested payload."""
    seen = seen if seen is not None else []
    if isinstance(node, dict):
        for key, value in node.items():
            seen.append(key.lower())
            _all_keys(value, seen)
    elif isinstance(node, list):
        for item in node:
            _all_keys(item, seen)
    return seen


@pytest.fixture(scope="module")
def client() -> TestClient:
    app = FastAPI()
    app.include_router(machining_router.router, prefix="/api/v1/cad")
    return TestClient(app)


def _upload(client, path: str, **form):
    with open(path, "rb") as fh:
        return client.post(
            ENDPOINT,
            files={"file": (path.split("/")[-1].split("\\")[-1], fh, "application/step")},
            data=form,
        )


# ---------------------------------------------------------------------------
# Request validation - these need no CAD kernel
# ---------------------------------------------------------------------------


class TestRequestValidation:
    def test_missing_file_is_a_422_from_fastapi(self, client):
        assert client.post(ENDPOINT, data={}).status_code == 422

    @pytest.mark.skipif(not occ.kernel_available(), reason="kernel gate returns 503 first")
    def test_unsupported_extension_is_rejected_with_415(self, client):
        response = client.post(
            ENDPOINT, files={"file": ("part.stl", b"solid\nendsolid\n")}
        )
        assert response.status_code == 415
        body = response.json()
        assert body["success"] is False
        assert body["errors"][0]["code"] == "UNSUPPORTED_FORMAT"
        assert ".step" in body["errors"][0]["detail"]["supported"]

    @pytest.mark.skipif(not occ.kernel_available(), reason="kernel gate returns 503 first")
    def test_an_empty_file_is_rejected(self, client):
        response = client.post(ENDPOINT, files={"file": ("part.step", b"")})
        assert response.status_code == 400
        assert response.json()["errors"][0]["code"] == "EMPTY_FILE"

    @pytest.mark.skipif(not occ.kernel_available(), reason="kernel gate returns 503 first")
    def test_a_corrupt_step_file_returns_a_client_error(self, client):
        response = client.post(
            ENDPOINT, files={"file": ("part.step", b"definitely not a STEP file")}
        )
        assert response.status_code in (400, 422)
        assert response.json()["success"] is False

    @pytest.mark.skipif(not occ.kernel_available(), reason="kernel gate returns 503 first")
    def test_oversized_uploads_are_rejected_with_413(self, client, monkeypatch):
        from app.machining.config import MachiningConfig

        small = MachiningConfig(max_upload_bytes=1024)
        monkeypatch.setattr(machining_router, "get_machining_config", lambda: small)
        response = client.post(
            ENDPOINT, files={"file": ("big.step", b"x" * 5000)}
        )
        assert response.status_code == 413
        assert response.json()["errors"][0]["code"] == "FILE_TOO_LARGE"

    def test_error_bodies_follow_the_documented_schema(self, client):
        response = client.post(ENDPOINT, files={"file": ("part.xyz", b"data")})
        body = response.json()
        assert set(body) >= {"success", "analysis_version", "errors", "warnings"}
        assert body["errors"][0]["code"] and body["errors"][0]["message"]


class TestCapabilities:
    def test_capabilities_reports_kernel_and_thresholds(self, client):
        body = client.get(f"{ENDPOINT}/capabilities").json()
        assert body["kernel_available"] == occ.kernel_available()
        assert "STEP" in body["supported_input_formats"]
        assert body["thresholds"]["stock_allowance_mm"] == 2.5
        assert "no cost" in body["note"].lower()

    def test_capabilities_states_the_scope_boundary(self, client):
        note = client.get(f"{ENDPOINT}/capabilities").json()["note"].lower()
        assert "price" in note and "geometry only" in note


@pytest.mark.skipif(occ.kernel_available(), reason="kernel is installed")
class TestWithoutKernel:
    def test_endpoint_reports_503_when_no_kernel_is_installed(self, client):
        response = client.post(ENDPOINT, files={"file": ("part.step", b"ISO-10303-21;")})
        assert response.status_code == 503
        assert response.json()["errors"][0]["code"] == "CAD_KERNEL_UNAVAILABLE"


# ---------------------------------------------------------------------------
# Full round trip
# ---------------------------------------------------------------------------


@requires_kernel
class TestSuccessfulAnalysis:
    @pytest.fixture(scope="class")
    @classmethod
    def result(cls, tmp_path_factory):
        app = FastAPI()
        app.include_router(machining_router.router, prefix="/api/v1/cad")
        client = TestClient(app)
        path = fixtures.block_with_counterbored_hole(tmp_path_factory.mktemp("api"))
        response = _upload(client, path)
        assert response.status_code == 200, response.text
        return response.json()

    def test_every_documented_top_level_section_is_present(self, result):
        expected = {
            "success",
            "analysis_version",
            "file",
            "model",
            "geometry",
            "topology",
            "surface_summary",
            "features",
            "feature_patterns",
            "accessibility",
            "setup_analysis",
            "stock_analysis",
            "machining_constraints",
            "complexity_indicators",
            "pmi",
            "warnings",
            "errors",
        }
        assert expected <= set(result)

    def test_feature_collection_has_every_documented_bucket(self, result):
        expected = {
            "holes",
            "bores",
            "pockets",
            "slots",
            "bosses",
            "threads",
            "fillets",
            "chamfers",
        }
        assert expected <= set(result["features"])

    def test_response_reports_success_and_no_errors(self, result):
        assert result["success"] is True
        assert result["errors"] == []

    def test_file_metadata_is_echoed_back(self, result):
        assert result["file"]["filename"].endswith(".step")
        assert result["file"]["format"] == "STEP"
        assert result["file"]["file_size_bytes"] > 0
        assert len(result["file"]["sha256"]) == 64

    def test_analysis_version_and_units_are_stated(self, result):
        assert result["analysis_version"] == "1.0"
        assert result["units"] == "mm"
        assert result["kernel"]

    def test_the_counterbored_hole_survives_the_round_trip(self, result):
        hole = result["features"]["holes"][0]
        assert hole["subtype"] == "counterbore"
        assert hole["counterbore_diameter_mm"] == pytest.approx(12.0)

    def test_no_cost_or_pricing_field_appears_anywhere(self, result):
        # Field *names* are checked, not free text: the disclaimers legitimately
        # contain the word "cost" while promising the opposite.
        forbidden = ("price", "cost", "hourly", "quote", "currency", "usd", "rate")
        leaked = [key for key in _all_keys(result) if any(w in key for w in forbidden)]
        assert leaked == [], f"response leaked pricing fields: {leaked}"

    def test_duration_is_reported(self, result):
        assert result["analysis_duration_ms"] >= 0


@requires_kernel
class TestOptionsOverHttp:
    def test_face_details_flag_is_honoured(self, client, tmp_path):
        path = fixtures.simple_block_with_through_hole(tmp_path)
        assert _upload(client, path).json()["face_details"] is None
        detailed = _upload(client, path, include_face_details="true").json()
        assert len(detailed["face_details"]) == 7

    def test_imperial_unit_system_is_honoured(self, client, tmp_path):
        path = fixtures.simple_block_with_through_hole(tmp_path)
        body = _upload(client, path, unit_system="imperial").json()
        assert body["units"] == "in"
        assert body["geometry"]["bounding_box"]["length_mm"] == pytest.approx(
            100.0 / 25.4, rel=1e-6
        )

    def test_an_invalid_unit_system_is_rejected(self, client, tmp_path):
        path = fixtures.simple_block_with_through_hole(tmp_path)
        assert _upload(client, path, unit_system="furlongs").status_code == 422

    def test_multiple_solids_warn_over_http(self, client, tmp_path):
        body = _upload(client, fixtures.two_body_assembly(tmp_path)).json()
        assert "MULTIPLE_SOLIDS" in {w["code"] for w in body["warnings"]}


@requires_kernel
class TestTemporaryFileHygiene:
    def test_no_temporary_files_are_left_behind(self, client, tmp_path):
        import glob
        import tempfile

        pattern = f"{tempfile.gettempdir()}/machining-*"
        before = set(glob.glob(pattern))
        _upload(client, fixtures.block_with_pocket(tmp_path))
        assert set(glob.glob(pattern)) - before == set()

    def test_temporary_files_are_removed_after_a_rejected_upload(self, client):
        import glob
        import tempfile

        pattern = f"{tempfile.gettempdir()}/machining-*"
        before = set(glob.glob(pattern))
        client.post(ENDPOINT, files={"file": ("bad.step", b"garbage")})
        assert set(glob.glob(pattern)) - before == set()
