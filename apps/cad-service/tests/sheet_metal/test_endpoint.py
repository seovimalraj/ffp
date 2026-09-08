"""Integration tests for ``POST /api/v1/cad/analyze-sheet-metal``.

Mirrors ``tests/machining/test_endpoint.py``. The happy path asserts that
model/topology/geometry are populated, that the Phase 2 detectors
(sheet_metal_candidate, thickness) have run and produced real values, and
that every detector section not yet implemented (bends, holes, ...) is still
present at its empty/default schema shape.
"""

from __future__ import annotations

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.v1 import sheet_metal as sheet_metal_router
from app.machining import occ

from . import fixtures
from .conftest import requires_kernel

ENDPOINT = "/api/v1/cad/analyze-sheet-metal"


@pytest.fixture(scope="module")
def client() -> TestClient:
    app = FastAPI()
    app.include_router(sheet_metal_router.router, prefix="/api/v1/cad")
    return TestClient(app)


def _upload(client, path: str, **form):
    with open(path, "rb") as fh:
        return client.post(
            ENDPOINT,
            files={"file": (path.split("/")[-1].split("\\")[-1], fh, "application/step")},
            data=form,
        )


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
        assert body["thresholds"]["min_sheet_thickness_mm"] == 0.4
        assert body["thresholds"]["max_sheet_thickness_mm"] == 6.0
        assert "no cost" in body["note"].lower()


@pytest.mark.skipif(occ.kernel_available(), reason="kernel is installed")
class TestWithoutKernel:
    def test_endpoint_reports_503_when_no_kernel_is_installed(self, client):
        response = client.post(ENDPOINT, files={"file": ("part.step", b"ISO-10303-21;")})
        assert response.status_code == 503
        assert response.json()["errors"][0]["code"] == "CAD_KERNEL_UNAVAILABLE"


@requires_kernel
class TestMissingKernelMocked:
    """Same 503 behaviour, forced via monkeypatch so it runs even when a
    kernel *is* installed in this environment."""

    def test_endpoint_reports_503_when_kernel_reports_unavailable(self, client, monkeypatch):
        monkeypatch.setattr(sheet_metal_router.occ, "kernel_available", lambda: False)
        response = client.post(ENDPOINT, files={"file": ("part.step", b"ISO-10303-21;")})
        assert response.status_code == 503
        assert response.json()["errors"][0]["code"] == "CAD_KERNEL_UNAVAILABLE"


@requires_kernel
class TestSuccessfulAnalysis:
    @pytest.fixture(scope="class")
    @classmethod
    def result(cls, tmp_path_factory):
        app = FastAPI()
        app.include_router(sheet_metal_router.router, prefix="/api/v1/cad")
        client = TestClient(app)
        path = fixtures.flat_plate_with_holes(tmp_path_factory.mktemp("api"))
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
            "sheet_metal_candidate",
            "thickness",
            "faces",
            "bends",
            "bend_reliefs",
            "holes",
            "cutouts",
            "slots",
            "hems",
            "outer_profile",
            "distance_flags",
            "feature_patterns",
            "symmetry",
            "complexity_indicators",
            "pmi",
            "warnings",
            "errors",
        }
        assert expected <= set(result)

    def test_response_reports_success_and_no_errors(self, result):
        assert result["success"] is True
        assert result["errors"] == []

    def test_file_metadata_is_echoed_back(self, result):
        assert result["file"]["filename"].endswith(".step")
        assert result["file"]["format"] == "STEP"
        assert result["file"]["file_size_bytes"] > 0
        assert len(result["file"]["sha256"]) == 64

    def test_model_topology_and_geometry_are_populated(self, result):
        assert result["model"]["face_count"] > 0
        assert result["model"]["solid_count"] >= 1
        assert result["geometry"] is not None
        assert result["geometry"]["volume_mm3"] > 0
        assert result["geometry"]["bounding_box"]["length_mm"] == pytest.approx(150.0, abs=1e-2)
        assert result["topology"]["closed_shell_count"] >= 1

    def test_sheet_candidate_and_thickness_detectors_have_run(self, result):
        # Phase 2: the flat-plate fixture is a sheet-metal candidate with a
        # measurable thickness.
        assert result["sheet_metal_candidate"]["is_candidate"] is True
        assert result["thickness"]["dominant_thickness_mm"] is not None

    def test_hole_detector_has_run_and_full_pipeline_is_populated(self, result):
        # Phase 4: the flat-plate-with-holes fixture has three real through
        # holes, so ``holes`` is now populated. It has no bends, cutouts,
        # slots or hems. Phase 5 (outer profile/distance checks/patterns/
        # complexity) now runs too: the three identical holes form a linear
        # feature pattern, and complexity_indicators counts them.
        assert result["bends"] == []
        assert len(result["holes"]) == 3
        assert result["cutouts"] == []
        assert result["slots"] == []
        assert result["hems"] == []
        assert result["distance_flags"] == []
        assert len(result["feature_patterns"]) == 1
        assert result["feature_patterns"][0]["pattern_type"] == "linear"
        assert result["outer_profile"]["perimeter_mm"] is not None
        assert result["complexity_indicators"]["feature_count_total"] == 3
        assert result["complexity_indicators"]["hole_count"] == 3

    def test_analysis_version_and_units_are_stated(self, result):
        assert result["units"] == "mm"
        assert result["kernel"]

    def test_no_cost_or_pricing_field_appears_anywhere(self, result):
        def _all_keys(node, seen=None):
            seen = seen if seen is not None else []
            if isinstance(node, dict):
                for key, value in node.items():
                    seen.append(key.lower())
                    _all_keys(value, seen)
            elif isinstance(node, list):
                for item in node:
                    _all_keys(item, seen)
            return seen

        forbidden = ("price", "cost", "hourly", "quote", "currency", "usd", "rate")
        leaked = [key for key in _all_keys(result) if any(w in key for w in forbidden)]
        assert leaked == [], f"response leaked pricing fields: {leaked}"

    def test_duration_is_reported(self, result):
        assert result["analysis_duration_ms"] >= 0


@requires_kernel
class TestTemporaryFileHygiene:
    def test_no_temporary_files_are_left_behind(self, client, tmp_path):
        import glob
        import tempfile

        pattern = f"{tempfile.gettempdir()}/machining-*"
        before = set(glob.glob(pattern))
        _upload(client, fixtures.solid_block_non_candidate(tmp_path))
        assert set(glob.glob(pattern)) - before == set()
