"""Parasolid (.x_t/.x_b) intake via the configured external converter.

OCCT has no Parasolid reader, so these tests stand in a fake converter rather
than a real translator. The fake copies its input to its output, which lets the
whole path - extension gate, subprocess call, STEP read, scratch cleanup - run
end to end against a STEP file that has simply been named ``.x_t``.
"""

from __future__ import annotations

import os
import shutil
import sys
from pathlib import Path

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.v1 import machining as machining_router
from app.machining import convert, occ
from app.machining.config import MachiningConfig
from app.machining.parser import (
    SUPPORTED_FORMATS,
    CADParseError,
    CADParser,
    available_formats,
    validate_extension,
)
from app.machining.schemas import WarningCode

from . import fixtures
from .conftest import requires_kernel

ENDPOINT = "/api/v1/cad/analyze-machining"


# ---------------------------------------------------------------------------
# Fake converters
# ---------------------------------------------------------------------------


def _script(tmp_path: Path, name: str, body: str) -> str:
    path = tmp_path / name
    path.write_text(body, encoding="utf-8")
    return str(path)


def _template(*parts: str) -> str:
    """Join command parts, quoting any that contain spaces.

    ``sys.executable`` and pytest tmp dirs both routinely contain spaces on
    Windows, so this is not hypothetical.
    """
    return " ".join(f'"{p}"' if " " in p else p for p in parts)


@pytest.fixture
def copying_converter(tmp_path) -> str:
    """A converter that succeeds by copying input to output."""
    script = _script(
        tmp_path,
        "fake_converter.py",
        "import shutil, sys\nshutil.copyfile(sys.argv[1], sys.argv[2])\n",
    )
    return _template(sys.executable, script, "{input}", "{output}")


@pytest.fixture
def failing_converter(tmp_path) -> str:
    script = _script(
        tmp_path,
        "failing_converter.py",
        "import sys\nsys.stderr.write('schema 34 unsupported')\nsys.exit(3)\n",
    )
    return _template(sys.executable, script, "{input}", "{output}")


@pytest.fixture
def silent_converter(tmp_path) -> str:
    """Exits 0 but never writes the output file."""
    script = _script(tmp_path, "silent_converter.py", "import sys\nsys.exit(0)\n")
    return _template(sys.executable, script, "{input}", "{output}")


@pytest.fixture
def hanging_converter(tmp_path) -> str:
    script = _script(tmp_path, "hanging_converter.py", "import time\ntime.sleep(30)\n")
    return _template(sys.executable, script, "{input}", "{output}")


def _config(cmd: str = "", **overrides) -> MachiningConfig:
    return MachiningConfig(parasolid_converter_cmd=cmd, **overrides)


def _as_parasolid(step_path: str, tmp_path: Path, name: str = "part.x_t") -> str:
    """Copy a STEP fixture under a Parasolid name."""
    target = tmp_path / name
    shutil.copyfile(step_path, target)
    return str(target)


# ---------------------------------------------------------------------------
# Extension gate - no kernel, no subprocess
# ---------------------------------------------------------------------------


class TestExtensionGate:
    @pytest.mark.parametrize("name", ["a.x_t", "a.X_T", "a.x_b", "a.xmt_txt", "a.xmt_bin"])
    def test_parasolid_extensions_are_known(self, name):
        assert SUPPORTED_FORMATS[os.path.splitext(name)[1].lower()] == "PARASOLID"

    @pytest.mark.parametrize("name", ["a.x_t", "a.x_b", "a.xmt_txt", "a.xmt_bin"])
    def test_rejected_with_415_when_no_converter_is_configured(self, name):
        with pytest.raises(CADParseError) as exc:
            validate_extension(name, _config())
        assert exc.value.status_code == 415
        assert exc.value.code == "PARASOLID_CONVERTER_UNAVAILABLE"
        # The message has to tell the user what to do instead.
        assert "STEP" in exc.value.message

    @pytest.mark.parametrize("name", ["a.x_t", "a.X_T", "a.x_b"])
    def test_accepted_once_a_converter_is_configured(self, name, copying_converter):
        assert validate_extension(name, _config(copying_converter)) == "PARASOLID"

    def test_available_formats_hides_parasolid_until_configured(self, copying_converter):
        assert ".x_t" not in available_formats(_config())
        assert ".x_t" in available_formats(_config(copying_converter))

    def test_step_is_unaffected_by_converter_configuration(self):
        assert validate_extension("a.step", _config()) == "STEP"
        assert ".step" in available_formats(_config())


# ---------------------------------------------------------------------------
# Command building
# ---------------------------------------------------------------------------


class TestCommandBuilding:
    def test_placeholders_are_substituted(self):
        argv = convert.build_command(
            "conv -i {input} -o {output} --units mm", "/in.x_t", "/out.step"
        )
        assert argv == ["conv", "-i", "/in.x_t", "-o", "/out.step", "--units", "mm"]

    def test_a_path_with_spaces_stays_one_argument(self):
        argv = convert.build_command("conv {input} {output}", "/a b/in.x_t", "/out.step")
        assert argv[1] == "/a b/in.x_t"
        assert len(argv) == 3

    def test_shell_metacharacters_in_a_path_are_not_split_out(self):
        """Substitution happens after the split, so a path is never re-parsed."""
        argv = convert.build_command(
            "conv {input} {output}", "/tmp/x; rm -rf /.x_t", "/out.step"
        )
        assert argv == ["conv", "/tmp/x; rm -rf /.x_t", "/out.step"]

    @pytest.mark.parametrize(
        "template", ["conv {input}", "conv {output}", "conv in out", ""]
    )
    def test_a_template_missing_a_placeholder_is_rejected(self, template):
        with pytest.raises(convert.ConversionError) as exc:
            convert.build_command(template, "/in.x_t", "/out.step")
        assert exc.value.status_code == 500
        assert exc.value.code == "PARASOLID_CONVERTER_MISCONFIGURED"


# ---------------------------------------------------------------------------
# Running the converter
# ---------------------------------------------------------------------------


class TestConverterExecution:
    def test_a_successful_conversion_returns_a_readable_step(
        self, tmp_path, copying_converter
    ):
        source = tmp_path / "part.x_t"
        source.write_text("ISO-10303-21;\nEND-ISO-10303-21;\n", encoding="utf-8")

        result = convert.to_step(str(source), _config(copying_converter))
        try:
            assert os.path.exists(result.path)
            assert Path(result.path).read_text(encoding="utf-8").startswith("ISO-10303-21")
            # Output goes to its own scratch dir, never next to the upload.
            assert Path(result.path).parent != source.parent
        finally:
            result.cleanup()
        assert not os.path.exists(result.workdir)

    def test_an_unconfigured_converter_raises_415(self, tmp_path):
        source = tmp_path / "part.x_t"
        source.write_text("x", encoding="utf-8")
        with pytest.raises(convert.ConversionError) as exc:
            convert.to_step(str(source), _config())
        assert exc.value.status_code == 415

    def test_a_missing_binary_is_reported_as_unavailable(self, tmp_path):
        source = tmp_path / "part.x_t"
        source.write_text("x", encoding="utf-8")
        cmd = _template(str(tmp_path / "definitely-not-here"), "{input}", "{output}")
        with pytest.raises(convert.ConversionError) as exc:
            convert.to_step(str(source), _config(cmd))
        assert exc.value.code == "PARASOLID_CONVERTER_UNAVAILABLE"
        assert exc.value.status_code == 503

    def test_a_nonzero_exit_reports_the_converter_output(self, tmp_path, failing_converter):
        source = tmp_path / "part.x_t"
        source.write_text("x", encoding="utf-8")
        with pytest.raises(convert.ConversionError) as exc:
            convert.to_step(str(source), _config(failing_converter))
        assert exc.value.code == "CONVERSION_FAILED"
        assert exc.value.status_code == 422
        assert "schema 34 unsupported" in exc.value.message

    def test_success_without_output_is_still_a_failure(self, tmp_path, silent_converter):
        source = tmp_path / "part.x_t"
        source.write_text("x", encoding="utf-8")
        with pytest.raises(convert.ConversionError) as exc:
            convert.to_step(str(source), _config(silent_converter))
        assert exc.value.code == "CONVERSION_FAILED"

    def test_a_hanging_converter_is_killed(self, tmp_path, hanging_converter):
        source = tmp_path / "part.x_t"
        source.write_text("x", encoding="utf-8")
        with pytest.raises(convert.ConversionError) as exc:
            convert.to_step(
                str(source),
                _config(hanging_converter, parasolid_converter_timeout_s=1.0),
            )
        assert exc.value.code == "CONVERSION_TIMEOUT"
        assert exc.value.status_code == 504

    def test_the_scratch_directory_is_removed_on_every_failure(
        self, tmp_path, failing_converter
    ):
        import tempfile

        before = set(os.listdir(tempfile.gettempdir()))
        source = tmp_path / "part.x_t"
        source.write_text("x", encoding="utf-8")
        with pytest.raises(convert.ConversionError):
            convert.to_step(str(source), _config(failing_converter))
        leaked = {
            name
            for name in set(os.listdir(tempfile.gettempdir())) - before
            if name.startswith("parasolid-")
        }
        assert not leaked


# ---------------------------------------------------------------------------
# Parser wiring - kernel stubbed out, so this runs everywhere
# ---------------------------------------------------------------------------


class TestReadParasolidWiring:
    """``_read_parasolid`` with the STEP read replaced by a stub.

    The kernel-backed version of this lives in ``TestParserLoadsParasolid``;
    these cover the plumbing on machines with no OCCT binding installed.
    """

    def _parser(self, cmd: str) -> CADParser:
        return CADParser(_config(cmd))

    def test_the_step_reader_is_handed_the_converted_file(
        self, tmp_path, copying_converter
    ):
        source = tmp_path / "part.x_t"
        source.write_text("ISO-10303-21;\n", encoding="utf-8")
        parser = self._parser(copying_converter)
        seen = {}

        def stub(path):
            seen["path"] = path
            seen["contents"] = Path(path).read_text(encoding="utf-8")
            return "shape"

        parser._read_step = stub
        warnings = []

        assert parser._read_parasolid(str(source), warnings) == "shape"
        assert seen["path"] != str(source)
        assert seen["path"].endswith(".step")
        assert seen["contents"].startswith("ISO-10303-21")

    def test_the_scratch_copy_is_removed_after_a_successful_read(
        self, tmp_path, copying_converter
    ):
        source = tmp_path / "part.x_t"
        source.write_text("ISO-10303-21;\n", encoding="utf-8")
        parser = self._parser(copying_converter)
        seen = {}

        def stub(path):
            seen["path"] = path
            return "shape"

        parser._read_step = stub
        parser._read_parasolid(str(source), [])

        assert not os.path.exists(seen["path"])
        assert os.path.exists(source), "the upload itself must survive"

    def test_the_scratch_copy_is_removed_when_the_read_fails(
        self, tmp_path, copying_converter
    ):
        source = tmp_path / "part.x_t"
        source.write_text("ISO-10303-21;\n", encoding="utf-8")
        parser = self._parser(copying_converter)
        seen = {}

        def stub(path):
            seen["path"] = path
            raise CADParseError("CORRUPT_CAD_FILE", "STEP import failed")

        parser._read_step = stub

        with pytest.raises(CADParseError) as exc:
            parser._read_parasolid(str(source), [])

        # Reported as a conversion failure, not as a bad upload.
        assert exc.value.code == "CONVERSION_FAILED"
        assert not os.path.exists(seen["path"])

    def test_conversion_errors_surface_as_parse_errors_with_their_status(
        self, tmp_path, failing_converter
    ):
        source = tmp_path / "part.x_t"
        source.write_text("x", encoding="utf-8")
        parser = self._parser(failing_converter)

        with pytest.raises(CADParseError) as exc:
            parser._read_parasolid(str(source), [])
        assert exc.value.code == "CONVERSION_FAILED"
        assert exc.value.status_code == 422

    def test_the_warning_names_the_converter_and_its_duration(
        self, tmp_path, copying_converter
    ):
        source = tmp_path / "part.x_t"
        source.write_text("ISO-10303-21;\n", encoding="utf-8")
        parser = self._parser(copying_converter)
        parser._read_step = lambda path: "shape"
        warnings = []

        parser._read_parasolid(str(source), warnings)

        assert len(warnings) == 1
        detail = warnings[0].detail
        assert warnings[0].code == WarningCode.FORMAT_CONVERTED
        assert detail["converter"].startswith(os.path.basename(sys.executable))
        assert isinstance(detail["conversion_duration_ms"], int)


# ---------------------------------------------------------------------------
# Full parser path
# ---------------------------------------------------------------------------


@requires_kernel
class TestParserLoadsParasolid:
    def test_a_converted_part_is_analysed_like_a_step_part(
        self, tmp_path, step_dir, copying_converter
    ):
        step = fixtures.simple_block_with_through_hole(step_dir)
        parasolid = _as_parasolid(step, tmp_path)

        parser = CADParser(_config(copying_converter))
        loaded = parser.load(
            parasolid, "part.x_t", os.path.getsize(parasolid), "0" * 64
        )

        assert loaded.file_format == "PARASOLID"
        assert not loaded.shape.IsNull()
        assert list(occ.iter_unique_shapes(loaded.shape, occ.TopAbs_SOLID))

    def test_the_conversion_is_reported_as_a_warning(
        self, tmp_path, step_dir, copying_converter
    ):
        step = fixtures.simple_block_with_through_hole(step_dir)
        parasolid = _as_parasolid(step, tmp_path)

        parser = CADParser(_config(copying_converter))
        loaded = parser.load(
            parasolid, "part.x_t", os.path.getsize(parasolid), "0" * 64
        )

        converted = [
            w for w in loaded.warnings if w.code == WarningCode.FORMAT_CONVERTED
        ]
        assert len(converted) == 1
        assert converted[0].detail["source_format"] == "PARASOLID"
        assert converted[0].detail["converted_to"] == "STEP"

    def test_the_uploaded_file_is_left_in_place_for_the_caller_to_delete(
        self, tmp_path, step_dir, copying_converter
    ):
        """The endpoint's ``finally`` owns the upload; conversion must not eat it."""
        step = fixtures.simple_block_with_through_hole(step_dir)
        parasolid = _as_parasolid(step, tmp_path)

        parser = CADParser(_config(copying_converter))
        loaded = parser.load(
            parasolid, "part.x_t", os.path.getsize(parasolid), "0" * 64
        )

        assert os.path.exists(parasolid)
        assert loaded.path == parasolid

    def test_a_converter_that_emits_junk_is_a_conversion_failure(self, tmp_path):
        junk = _script(
            tmp_path,
            "junk_converter.py",
            "import sys\nopen(sys.argv[2], 'w').write('not a step file')\n",
        )
        source = tmp_path / "part.x_t"
        source.write_text("x", encoding="utf-8")

        parser = CADParser(
            _config(_template(sys.executable, junk, "{input}", "{output}"))
        )
        with pytest.raises(CADParseError) as exc:
            parser.load(str(source), "part.x_t", source.stat().st_size, "0" * 64)
        assert exc.value.code == "CONVERSION_FAILED"


# ---------------------------------------------------------------------------
# Endpoint
# ---------------------------------------------------------------------------


@pytest.fixture(scope="module")
def client() -> TestClient:
    app = FastAPI()
    app.include_router(machining_router.router, prefix="/api/v1/cad")
    return TestClient(app)


class TestEndpoint:
    @pytest.mark.skipif(
        not occ.kernel_available(), reason="kernel gate returns 503 first"
    )
    def test_parasolid_upload_is_refused_when_unconfigured(self, client, monkeypatch):
        monkeypatch.setattr(machining_router, "get_machining_config", _config)
        response = client.post(ENDPOINT, files={"file": ("part.x_t", b"**ABCDEFGHI")})

        assert response.status_code == 415
        error = response.json()["errors"][0]
        assert error["code"] == "PARASOLID_CONVERTER_UNAVAILABLE"
        # The advertised list must not include what was just refused.
        assert ".x_t" not in error["detail"]["supported"]

    def test_capabilities_reports_conversion_availability(
        self, client, monkeypatch, copying_converter
    ):
        monkeypatch.setattr(machining_router, "get_machining_config", _config)
        body = client.get(f"{ENDPOINT}/capabilities").json()
        assert body["parasolid_conversion_available"] is False
        assert ".x_t" not in body["supported_extensions"]

        monkeypatch.setattr(
            machining_router, "get_machining_config", lambda: _config(copying_converter)
        )
        body = client.get(f"{ENDPOINT}/capabilities").json()
        assert body["parasolid_conversion_available"] is True
        assert ".x_t" in body["supported_extensions"]
        assert "PARASOLID" in body["supported_input_formats"]

    @requires_kernel
    def test_a_converted_upload_analyses_successfully(
        self, client, monkeypatch, tmp_path, step_dir, copying_converter
    ):
        monkeypatch.setattr(
            machining_router, "get_machining_config", lambda: _config(copying_converter)
        )
        step = fixtures.simple_block_with_through_hole(step_dir)
        parasolid = _as_parasolid(step, tmp_path)

        with open(parasolid, "rb") as fh:
            response = client.post(
                ENDPOINT, files={"file": ("part.x_t", fh, "model/x-t")}
            )

        assert response.status_code == 200, response.text
        payload = response.json()
        assert payload["success"] is True
        assert any(
            w["code"] == "FORMAT_CONVERTED" for w in payload.get("warnings", [])
        )
