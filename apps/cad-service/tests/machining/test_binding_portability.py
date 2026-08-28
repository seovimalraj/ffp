"""Regression tests for OCP / pythonocc-core binding portability.

These exist because of a production failure: the code called ``.Extent()`` on a
``TopTools_IndexedDataMapOfShapeListOfShape``, which OCP exposes and
pythonocc-core does not. It passed every local test (OCP) and broke in Docker
(pythonocc-core).

Everything here runs without a CAD kernel, so the guard holds in any
environment - including one that only has the binding the bug did not affect.
"""

from __future__ import annotations

import ast
from pathlib import Path

import pytest

from app.machining.occ import ShapeIndex

MACHINING_ROOT = Path(__file__).resolve().parents[2] / "app" / "machining"


def machining_sources():
    return sorted(MACHINING_ROOT.rglob("*.py"))


class TestNoFragileCollectionApis:
    """Static guards against re-introducing binding-specific collection calls."""

    #: Methods OCCT collections expose inconsistently across the two bindings.
    FRAGILE_METHODS = ("Extent", "FindFromIndex", "FindKey", "FindIndex")

    def test_no_occt_collection_size_or_index_calls(self):
        offenders = []
        for path in machining_sources():
            tree = ast.parse(path.read_text(encoding="utf-8"), filename=str(path))
            for node in ast.walk(tree):
                if (
                    isinstance(node, ast.Call)
                    and isinstance(node.func, ast.Attribute)
                    and node.func.attr in self.FRAGILE_METHODS
                ):
                    offenders.append(
                        f"{path.relative_to(MACHINING_ROOT)}:{node.lineno} "
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
        for path in machining_sources():
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

    def test_no_direct_binding_imports_outside_the_shim(self):
        """Only `occ.py` may name a binding root; everything else goes through it."""
        offenders = []
        for path in machining_sources():
            if path.name == "occ.py":
                continue
            for number, line in enumerate(
                path.read_text(encoding="utf-8").splitlines(), start=1
            ):
                stripped = line.strip()
                if stripped.startswith(("import OCC", "import OCP", "from OCC", "from OCP")):
                    offenders.append(f"{path.name}:{number}")
        assert offenders == [], (
            "Import OCCT symbols from app.machining.occ, not from the binding "
            f"directly: {offenders}"
        )


class _StubShape:
    """A shape stand-in with controllable hashing and OCCT-style equality."""

    def __init__(self, identity: int, hash_code: int):
        self.identity = identity
        self._hash_code = hash_code

    def HashCode(self, _upper_bound: int) -> int:
        return self._hash_code

    def IsSame(self, other: "_StubShape") -> bool:
        return isinstance(other, _StubShape) and other.identity == self.identity


class _NoHashCodeShape:
    """A 7.8 / OCP style shape: no HashCode, relies on __hash__."""

    def __init__(self, identity: int):
        self.identity = identity

    def __hash__(self) -> int:
        return self.identity * 7919

    def IsSame(self, other: "_NoHashCodeShape") -> bool:
        return isinstance(other, _NoHashCodeShape) and other.identity == self.identity


class TestShapeIndex:
    def test_the_same_shape_keeps_one_identity(self):
        index = ShapeIndex()
        shape = _StubShape(identity=1, hash_code=42)
        assert index.identify(shape) == index.identify(shape)
        assert len(index) == 1

    def test_two_handles_to_the_same_shape_share_an_identity(self):
        # OCCT hands back a fresh Python wrapper on every traversal.
        index = ShapeIndex()
        first = _StubShape(identity=1, hash_code=42)
        second = _StubShape(identity=1, hash_code=42)
        assert index.identify(first) == index.identify(second)
        assert len(index) == 1

    def test_distinct_shapes_stay_distinct(self):
        index = ShapeIndex()
        assert index.identify(_StubShape(1, 10)) != index.identify(_StubShape(2, 20))
        assert len(index) == 2

    def test_a_hash_collision_does_not_merge_two_shapes(self):
        # The failure this guards: HashCode is bounded, so at tens of thousands
        # of faces collisions are expected, and merging two faces into one
        # record would corrupt adjacency silently.
        index = ShapeIndex()
        first = index.identify(_StubShape(identity=1, hash_code=777))
        second = index.identify(_StubShape(identity=2, hash_code=777))
        assert first != second
        assert len(index) == 2

    def test_shapes_without_hashcode_fall_back_to_python_hashing(self):
        index = ShapeIndex()
        assert index.identify(_NoHashCodeShape(1)) == index.identify(_NoHashCodeShape(1))
        assert index.identify(_NoHashCodeShape(1)) != index.identify(_NoHashCodeShape(2))

    def test_lookup_finds_a_known_shape(self):
        index = ShapeIndex()
        identity = index.identify(_StubShape(1, 5))
        assert index.lookup(_StubShape(1, 5)) == identity

    def test_lookup_returns_none_for_an_unknown_shape(self):
        index = ShapeIndex()
        index.identify(_StubShape(1, 5))
        assert index.lookup(_StubShape(2, 6)) is None

    def test_lookup_does_not_assign_an_identity(self):
        index = ShapeIndex()
        index.lookup(_StubShape(1, 5))
        assert len(index) == 0

    def test_identities_are_assigned_in_encounter_order(self):
        # Deterministic ids are what make the whole response reproducible.
        index = ShapeIndex()
        assert [index.identify(_StubShape(i, i)) for i in range(1, 5)] == [1, 2, 3, 4]

    def test_a_shape_without_issame_degrades_to_object_identity(self):
        class Bare:
            def __hash__(self) -> int:
                return 1

        index = ShapeIndex()
        first, second = Bare(), Bare()
        assert index.identify(first) != index.identify(second)
        assert index.identify(first) == index.identify(first)


class TestNoBareStaticLookups:
    """OCCT static methods must be resolved through the shim, never by name.

    OCP suffixes every static with ``_s`` (``BRepTools.Read_s``) and
    pythonocc-core does not. A bare ``getattr(holder, "Read", None)`` therefore
    returns ``None`` on one binding and a working function on the other - and
    because these call sites treat ``None`` as "feature unavailable", the
    failure is silent: BREP import turned into a 415, and the STEP unit pin
    into a no-op that reported inches under ``_mm`` field names.
    """

    #: Names that look like OCCT statics: CamelCase, no underscore prefix.
    def _is_occt_static_name(self, name: str) -> bool:
        return bool(name) and name[0].isupper() and not name.startswith("_")

    def test_getattr_is_not_used_to_look_up_occt_statics(self):
        offenders = []
        for path in machining_sources():
            if path.name == "occ.py":
                continue  # the shim is where _resolve_static legitimately lives
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
                        f"{path.relative_to(MACHINING_ROOT)}:{node.lineno} "
                        f"getattr(..., {node.args[1].value!r})"
                    )
        assert offenders == [], (
            "OCCT static methods are named differently on the two bindings "
            "(OCP appends '_s'). Resolve them through app.machining.occ "
            "(_resolve_static, or a wrapper such as set_static_cval / "
            "read_brep) instead of getattr:\n  " + "\n  ".join(offenders)
        )
