"""Regression tests for OCP / pythonocc-core binding portability, mirroring
``tests/machining/test_binding_portability.py`` but pointed at
``app.sheet_metal``.

The sheet-metal package never talks to the CAD kernel directly - it consumes
``ShapeModel``/``FaceRecord``/``EdgeRecord`` objects built by
``app.machining.parser`` and only ever reaches OCCT (when it needs to at all)
through ``app.machining.occ``. These are therefore *static* guards: they hold
in any environment, including a sandbox that only has one of the two bindings
installed, because they never import or exercise OCCT themselves. CI running
both bindings (OCP and pythonocc-core) is what actually proves the runtime
behaviour is identical; these tests prove the source never re-introduces a
binding-specific dependency that would break that promise.
"""

from __future__ import annotations

import ast
from pathlib import Path

import pytest

from app.machining import occ

SHEET_METAL_ROOT = Path(__file__).resolve().parents[2] / "app" / "sheet_metal"


def sheet_metal_sources():
    return sorted(SHEET_METAL_ROOT.rglob("*.py"))


class TestKernelAgnosticEnvironment:
    """Sanity check on whatever binding this environment happens to have."""

    def test_kernel_name_is_a_known_binding_or_none(self):
        # Only one binding may be installed in this sandbox; CI installs both
        # in separate jobs. Either way, whatever is reported must be one of
        # the two supported bindings (or None if no kernel is installed at
        # all) - never a stray/unexpected value.
        name = occ.kernel_name()
        assert name in ("OCP", "OCC.Core", None)

    def test_kernel_available_is_consistent_with_kernel_name(self):
        assert occ.kernel_available() == (occ.kernel_name() is not None)


class TestNoFragileCollectionApis:
    """Static guards against re-introducing binding-specific collection calls."""

    #: Methods OCCT collections expose inconsistently across the two bindings.
    FRAGILE_METHODS = ("Extent", "FindFromIndex", "FindKey", "FindIndex")

    def test_no_occt_collection_size_or_index_calls(self):
        offenders = []
        for path in sheet_metal_sources():
            tree = ast.parse(path.read_text(encoding="utf-8"), filename=str(path))
            for node in ast.walk(tree):
                if (
                    isinstance(node, ast.Call)
                    and isinstance(node.func, ast.Attribute)
                    and node.func.attr in self.FRAGILE_METHODS
                ):
                    offenders.append(
                        f"{path.relative_to(SHEET_METAL_ROOT)}:{node.lineno} "
                        f"calls .{node.func.attr}()"
                    )
        assert offenders == [], (
            "OCCT collection index/size methods are not portable between OCP and "
            "pythonocc-core. Use app.machining.occ.ShapeIndex instead:\n  "
            + "\n  ".join(offenders)
        )

    def test_toptools_collections_are_not_used(self):
        """No *code* reference to the indexed collections.

        Parsed rather than grepped, so docstrings explaining why they are
        avoided do not trip the guard.
        """
        offenders = []
        for path in sheet_metal_sources():
            tree = ast.parse(path.read_text(encoding="utf-8"), filename=str(path))
            for node in ast.walk(tree):
                name = None
                if isinstance(node, ast.Name):
                    name = node.id
                elif isinstance(node, ast.Attribute):
                    name = node.attr
                elif isinstance(node, ast.Constant) and isinstance(node.value, str):
                    # Symbol names are also loaded by string through the shim.
                    name = node.value
                if name and name.startswith("TopTools_Indexed"):
                    offenders.append(f"{path.name}:{getattr(node, 'lineno', '?')} {name}")
        assert offenders == [], (
            "TopTools indexed collections differ between OCP and "
            f"pythonocc-core; use ShapeIndex instead: {offenders}"
        )

    def test_no_direct_binding_imports(self):
        """``app.sheet_metal`` must never name a binding root directly - all
        OCCT access goes through ``app.machining.occ``."""
        offenders = []
        for path in sheet_metal_sources():
            for number, line in enumerate(
                path.read_text(encoding="utf-8").splitlines(), start=1
            ):
                stripped = line.strip()
                if stripped.startswith(("import OCC", "import OCP", "from OCC", "from OCP")):
                    offenders.append(f"{path.relative_to(SHEET_METAL_ROOT)}:{number}")
        assert offenders == [], (
            "Import OCCT symbols from app.machining.occ, not from the binding "
            f"directly: {offenders}"
        )


class TestNoBareStaticLookups:
    """OCCT static methods must be resolved through the shim, never by name.

    OCP suffixes every static with ``_s`` (``BRepTools.Read_s``) and
    pythonocc-core does not. A bare ``getattr(holder, "Read", None)`` therefore
    returns ``None`` on one binding and a working function on the other.
    """

    def _is_occt_static_name(self, name: str) -> bool:
        return bool(name) and name[0].isupper() and not name.startswith("_")

    def test_getattr_is_not_used_to_look_up_occt_statics(self):
        offenders = []
        for path in sheet_metal_sources():
            tree = ast.parse(path.read_text(encoding="utf-8"), filename=str(path))
            for node in ast.walk(tree):
                if (
                    isinstance(node, ast.Call)
                    and isinstance(node.func, ast.Name)
                    and node.func.id == "getattr"
                    and len(node.args) >= 2
                    and isinstance(node.args[1], ast.Constant)
                    and isinstance(node.args[1].value, str)
                    and self._is_occt_static_name(node.args[1].value)
                ):
                    offenders.append(
                        f"{path.relative_to(SHEET_METAL_ROOT)}:{node.lineno} "
                        f"getattr(..., {node.args[1].value!r})"
                    )
        assert offenders == [], (
            "OCCT static methods are named differently on the two bindings "
            "(OCP appends '_s'). Resolve them through app.machining.occ "
            "instead of getattr:\n  " + "\n  ".join(offenders)
        )


@pytest.mark.skipif(not occ.kernel_available(), reason="No OCC kernel installed")
class TestDetectorsRunUnderInstalledBinding:
    """End-to-end proof that the pipeline runs cleanly under whichever
    binding this environment provides. Combined with the static guards above
    (which hold regardless of which binding is installed) and CI running both
    bindings, this establishes binding-agnosticism without requiring both
    bindings in every environment."""

    def test_pipeline_runs_against_a_generated_fixture(self, analyze, step_dir):
        from . import fixtures

        step_path = fixtures.flat_plate_with_holes(step_dir)
        payload = analyze(step_path)
        assert payload["sheet_metal_candidate"]["is_candidate"] is True
