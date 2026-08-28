"""OpenCASCADE binding shim.

Supports both binding flavours with the same call sites:

* ``OCP``            (preferred - CadQuery's binding, newer OCCT)
* ``pythonocc-core`` (accepted - module root ``OCC.Core``)

Both expose identical OCCT class names; only the package root differs. Every
other module in this package imports symbols from here rather than importing
``OCC.Core.*`` or ``OCP.*`` directly, so the rest of the code is
binding-agnostic and importable even when no kernel is installed (the symbols
are simply ``None`` and :func:`require_kernel` raises).
"""

from __future__ import annotations

import importlib
import logging
from typing import Any, Optional

logger = logging.getLogger(__name__)

#: Module roots probed in preference order.
_BINDING_ROOTS = ("OCP", "OCC.Core")

_binding_name: Optional[str] = None
_root: Optional[str] = None


def _probe() -> Optional[str]:
    """Return the importable binding root, or ``None`` when no kernel exists."""
    for root in _BINDING_ROOTS:
        try:
            importlib.import_module(f"{root}.TopoDS")
            return root
        except Exception:  # pragma: no cover - depends on the environment
            continue
    return None


_root = _probe()
_binding_name = {"OCP": "OCP", "OCC.Core": "pythonocc-core"}.get(_root or "")


def kernel_available() -> bool:
    """True when an OpenCASCADE Python binding is importable."""
    return _root is not None


def kernel_name() -> Optional[str]:
    """Name of the active binding (``OCP`` / ``pythonocc-core``) or ``None``."""
    return _binding_name


def require_kernel() -> None:
    """Raise when no CAD kernel is installed.

    Callers convert this into an HTTP 503 - the service is deployable without
    OCCT, but the machining endpoint cannot function without it.
    """
    if not kernel_available():
        raise KernelUnavailable(
            "No OpenCASCADE binding found. Install 'OCP' (preferred) or "
            "'pythonocc-core' (conda-forge) to enable machining analysis."
        )


class KernelUnavailable(RuntimeError):
    """Raised when OCCT is needed but not installed."""


def _load(module: str, *names: str) -> tuple:
    """Import ``names`` from ``<root>.<module>``; return ``None`` placeholders.

    Missing individual symbols are tolerated because the two bindings differ in
    a handful of helper names across OCCT versions; each call site that depends
    on an optional symbol checks for ``None`` first.
    """
    if _root is None:
        return tuple(None for _ in names)
    try:
        mod = importlib.import_module(f"{_root}.{module}")
    except Exception as exc:  # pragma: no cover
        logger.debug("machining: optional OCC module %s unavailable: %s", module, exc)
        return tuple(None for _ in names)
    return tuple(getattr(mod, name, None) for name in names)


# --- topology -------------------------------------------------------------
(TopoDS_Shape, TopoDS_Face, TopoDS_Edge, topods, TopoDS) = _load(
    "TopoDS", "TopoDS_Shape", "TopoDS_Face", "TopoDS_Edge", "topods", "TopoDS"
)
(TopExp_Explorer, topexp) = _load("TopExp", "TopExp_Explorer", "topexp")
(
    TopAbs_SOLID,
    TopAbs_SHELL,
    TopAbs_FACE,
    TopAbs_EDGE,
    TopAbs_VERTEX,
    TopAbs_COMPOUND,
    TopAbs_WIRE,
    TopAbs_REVERSED,
    TopAbs_FORWARD,
) = _load(
    "TopAbs",
    "TopAbs_SOLID",
    "TopAbs_SHELL",
    "TopAbs_FACE",
    "TopAbs_EDGE",
    "TopAbs_VERTEX",
    "TopAbs_COMPOUND",
    "TopAbs_WIRE",
    "TopAbs_REVERSED",
    "TopAbs_FORWARD",
)

# --- geometry adaptors ----------------------------------------------------
(BRepAdaptor_Surface, BRepAdaptor_Curve) = _load(
    "BRepAdaptor", "BRepAdaptor_Surface", "BRepAdaptor_Curve"
)
(
    GeomAbs_Plane,
    GeomAbs_Cylinder,
    GeomAbs_Cone,
    GeomAbs_Sphere,
    GeomAbs_Torus,
    GeomAbs_BezierSurface,
    GeomAbs_BSplineSurface,
    GeomAbs_SurfaceOfRevolution,
    GeomAbs_SurfaceOfExtrusion,
    GeomAbs_OffsetSurface,
    GeomAbs_OtherSurface,
    GeomAbs_Line,
    GeomAbs_Circle,
    GeomAbs_Ellipse,
    GeomAbs_BSplineCurve,
) = _load(
    "GeomAbs",
    "GeomAbs_Plane",
    "GeomAbs_Cylinder",
    "GeomAbs_Cone",
    "GeomAbs_Sphere",
    "GeomAbs_Torus",
    "GeomAbs_BezierSurface",
    "GeomAbs_BSplineSurface",
    "GeomAbs_SurfaceOfRevolution",
    "GeomAbs_SurfaceOfExtrusion",
    "GeomAbs_OffsetSurface",
    "GeomAbs_OtherSurface",
    "GeomAbs_Line",
    "GeomAbs_Circle",
    "GeomAbs_Ellipse",
    "GeomAbs_BSplineCurve",
)

# --- properties -----------------------------------------------------------
(GProp_GProps,) = _load("GProp", "GProp_GProps")
(brepgprop, BRepGProp) = _load("BRepGProp", "brepgprop", "BRepGProp")
(Bnd_Box, Bnd_OBB) = _load("Bnd", "Bnd_Box", "Bnd_OBB")
(brepbndlib, BRepBndLib) = _load("BRepBndLib", "brepbndlib", "BRepBndLib")

# --- shape healing --------------------------------------------------------
(BRepBuilderAPI_Sewing, BRepBuilderAPI_MakeSolid) = _load(
    "BRepBuilderAPI", "BRepBuilderAPI_Sewing", "BRepBuilderAPI_MakeSolid"
)
(ShapeFix_Solid, ShapeFix_Shell, ShapeFix_Shape) = _load(
    "ShapeFix", "ShapeFix_Solid", "ShapeFix_Shell", "ShapeFix_Shape"
)
(BRep_Builder,) = _load("BRep", "BRep_Builder")
(TopoDS_Compound, TopoDS_Shell, TopoDS_Solid) = _load(
    "TopoDS", "TopoDS_Compound", "TopoDS_Shell", "TopoDS_Solid"
)

# --- surface access -------------------------------------------------------
(BRep_Tool,) = _load("BRep", "BRep_Tool")
(breptools, BRepTools) = _load("BRepTools", "breptools", "BRepTools")
(BRepLProp_SLProps,) = _load("BRepLProp", "BRepLProp_SLProps")
(BRepCheck_Analyzer,) = _load("BRepCheck", "BRepCheck_Analyzer")
(BRepClass3d_SolidClassifier,) = _load("BRepClass3d", "BRepClass3d_SolidClassifier")
(TopAbs_IN, TopAbs_OUT, TopAbs_ON) = _load("TopAbs", "TopAbs_IN", "TopAbs_OUT", "TopAbs_ON")

# --- ray casting (accessibility) -----------------------------------------
(BRepIntCurveSurface_Inter,) = _load("BRepIntCurveSurface", "BRepIntCurveSurface_Inter")
(gp_Pnt, gp_Dir, gp_Vec, gp_Lin, gp_Ax1, gp_Pln, gp_XYZ) = _load(
    "gp", "gp_Pnt", "gp_Dir", "gp_Vec", "gp_Lin", "gp_Ax1", "gp_Pln", "gp_XYZ"
)

# --- readers --------------------------------------------------------------
(STEPControl_Reader,) = _load("STEPControl", "STEPControl_Reader")
(IGESControl_Reader,) = _load("IGESControl", "IGESControl_Reader")
(IFSelect_RetDone,) = _load("IFSelect", "IFSelect_RetDone")
(Interface_Static,) = _load("Interface", "Interface_Static")

# --- STEP metadata / PMI (XCAF) ------------------------------------------
(STEPCAFControl_Reader,) = _load("STEPCAFControl", "STEPCAFControl_Reader")
(TDocStd_Document,) = _load("TDocStd", "TDocStd_Document")
(XCAFDoc_DocumentTool,) = _load("XCAFDoc", "XCAFDoc_DocumentTool")
(TDF_LabelSequence, TDF_Label) = _load("TDF", "TDF_LabelSequence", "TDF_Label")
(TDataStd_Name,) = _load("TDataStd", "TDataStd_Name")
(TCollection_ExtendedString, TCollection_AsciiString) = _load(
    "TCollection", "TCollection_ExtendedString", "TCollection_AsciiString"
)
(BinXCAFDrivers,) = _load("BinXCAFDrivers", "BinXCAFDrivers")


def surface_props(shape: Any) -> float:
    """Surface area of ``shape`` in file units (mm)."""
    props = GProp_GProps()
    _surface_properties(shape, props)
    return float(props.Mass())


def volume_props(shape: Any):
    """Return the OCCT volume ``GProp_GProps`` for ``shape``."""
    props = GProp_GProps()
    _volume_properties(shape, props)
    return props


def linear_props(shape: Any):
    """Return the OCCT linear (edge length) ``GProp_GProps`` for ``shape``."""
    props = GProp_GProps()
    _linear_properties(shape, props)
    return props


def _resolve_static(holders: tuple, *names: str):
    """Find a callable across binding naming conventions.

    OCP suffixes every static method with ``_s`` (``Add_s``), pythonocc exposes
    a lowercase singleton with the bare name (``brepbndlib.Add``), and older
    pythonocc builds used module-level ``brepbndlib_Add`` functions. Trying all
    three is what keeps a single call site working on both bindings.
    """
    for holder in holders:
        if holder is None:
            continue
        for name in names:
            for candidate in (name, f"{name}_s"):
                fn = getattr(holder, candidate, None)
                if fn is not None:
                    return fn
    return None


def _call_gprop(name: str, shape: Any, props: Any) -> None:
    """Invoke a BRepGProp routine across binding/version naming differences."""
    fn = _resolve_static((brepgprop, BRepGProp), name)
    if fn is None:
        raise KernelUnavailable(f"BRepGProp.{name} unavailable in this binding")
    fn(shape, props)


def _volume_properties(shape: Any, props: Any) -> None:
    _call_gprop("VolumeProperties", shape, props)


def _surface_properties(shape: Any, props: Any) -> None:
    _call_gprop("SurfaceProperties", shape, props)


def _linear_properties(shape: Any, props: Any) -> None:
    _call_gprop("LinearProperties", shape, props)


def add_to_bbox(shape: Any, box: Any, use_triangulation: bool = False) -> None:
    """``BRepBndLib::Add`` across bindings."""
    fn = _resolve_static((brepbndlib, BRepBndLib), "Add", "brepbndlib_Add")
    if fn is None:
        raise KernelUnavailable("BRepBndLib.Add unavailable in this binding")
    fn(shape, box, use_triangulation)


def oriented_bbox(shape: Any) -> Optional[tuple]:
    """``BRepBndLib::AddOBB`` -> ``(half_sizes, axes, center)``, or ``None``.

    The oriented box is what makes stock-form classification survive a part
    modelled off-axis: the axis-aligned box of a rotated plate has three
    comparable dimensions and reads as a block. ``Bnd_OBB`` arrived in OCCT 7.x
    and the accessor names differ between bindings, so every step is optional
    and the caller falls back to the axis-aligned box when this returns
    ``None``.
    """
    if Bnd_OBB is None:
        return None
    fn = _resolve_static((brepbndlib, BRepBndLib), "AddOBB", "brepbndlib_AddOBB")
    if fn is None:
        return None
    try:
        obb = Bnd_OBB()
        fn(shape, obb, True, True, True)
        if obb.IsVoid():
            return None
        half = (
            float(obb.XHSize()),
            float(obb.YHSize()),
            float(obb.ZHSize()),
        )
        axes = tuple(
            (float(d.X()), float(d.Y()), float(d.Z()))
            for d in (obb.XDirection(), obb.YDirection(), obb.ZDirection())
        )
        pos = obb.Center()
        center = (float(pos.X()), float(pos.Y()), float(pos.Z()))
    except Exception as exc:
        logger.debug("machining: oriented bounding box unavailable: %s", exc)
        return None
    return half, axes, center


def face_uv_bounds(face: Any) -> tuple:
    """``BRepTools::UVBounds`` across bindings -> ``(umin, umax, vmin, vmax)``."""
    fn = _resolve_static((breptools, BRepTools), "UVBounds")
    if fn is None:
        raise KernelUnavailable("BRepTools.UVBounds unavailable in this binding")
    result = fn(face)
    if result is not None:
        return tuple(float(v) for v in result)
    raise KernelUnavailable("BRepTools.UVBounds returned no bounds")


class ShapeIndex:
    """Collision-safe identity for ``TopoDS_Shape`` objects.

    OCCT's own indexed collections would do this, but the two bindings disagree
    about which of their methods they expose (pythonocc-core omits ``Extent``
    on ``TopTools_IndexedDataMapOfShapeListOfShape``, for one), so identity is
    resolved here instead using only methods every binding has.

    ``HashCode``/``__hash__`` alone is not enough: it is bounded, and at tens of
    thousands of faces a collision is likely rather than remote - two distinct
    faces sharing a bucket would silently merge into one record. Hashing is
    therefore used only to narrow the search, and ``IsSame`` (OCCT's own
    orientation-independent equality) decides.
    """

    __slots__ = ("_buckets", "_next_id")

    def __init__(self) -> None:
        self._buckets: dict = {}
        self._next_id = 1

    @staticmethod
    def _hash_of(shape: Any) -> int:
        hash_code = getattr(shape, "HashCode", None)
        if hash_code is not None:
            try:
                return int(hash_code(1 << 30))
            except Exception:
                pass
        # OCCT 7.8 / OCP dropped HashCode in favour of Python's __hash__.
        try:
            return hash(shape)
        except Exception:
            return id(shape)

    @staticmethod
    def _is_same(a: Any, b: Any) -> bool:
        is_same = getattr(a, "IsSame", None)
        if is_same is None:
            return a is b
        try:
            return bool(is_same(b))
        except Exception:
            return a is b

    def identify(self, shape: Any) -> int:
        """Return a stable id for ``shape``, assigning one on first sight."""
        bucket = self._buckets.setdefault(self._hash_of(shape), [])
        for existing, identity in bucket:
            if self._is_same(existing, shape):
                return identity
        identity = self._next_id
        self._next_id += 1
        bucket.append((shape, identity))
        return identity

    def lookup(self, shape: Any) -> Optional[int]:
        """Return the id of an already-seen shape, or ``None``."""
        for existing, identity in self._buckets.get(self._hash_of(shape), ()):
            if self._is_same(existing, shape):
                return identity
        return None

    def __len__(self) -> int:
        return self._next_id - 1


def _downcast(shape: Any, kind: str) -> Any:
    """Cast a generic ``TopoDS_Shape`` to ``TopoDS_Face`` / ``TopoDS_Edge``.

    ``TopExp_Explorer`` and the ancestor maps hand back base-class shapes, but
    ``BRepAdaptor_Surface``/``BRepAdaptor_Curve`` only accept the concrete type.
    """
    fn = _resolve_static((topods, TopoDS), kind)
    if fn is None:
        return shape
    try:
        return fn(shape)
    except Exception:
        return shape


def to_face(shape: Any) -> Any:
    return _downcast(shape, "Face")


def to_edge(shape: Any) -> Any:
    return _downcast(shape, "Edge")


def to_vertex(shape: Any) -> Any:
    return _downcast(shape, "Vertex")


def to_shell(shape: Any) -> Any:
    return _downcast(shape, "Shell")


def make_compound(shapes: list) -> Any:
    """Wrap several shapes in a TopoDS_Compound."""
    builder = BRep_Builder()
    compound = TopoDS_Compound()
    builder.MakeCompound(compound)
    for shape in shapes:
        builder.Add(compound, shape)
    return compound


def iter_shapes(shape: Any, shape_type: Any):
    """Yield every sub-shape of ``shape_type`` contained in ``shape``."""
    explorer = TopExp_Explorer(shape, shape_type)
    while explorer.More():
        yield explorer.Current()
        explorer.Next()


def iter_unique_shapes(shape: Any, shape_type: Any):
    """Yield each distinct sub-shape once.

    ``TopExp_Explorer`` revisits shapes shared between parents - a face shared
    by two solids, an edge shared by two faces - so a solid's face count would
    otherwise be inflated. Deduplication goes through :class:`ShapeIndex` rather
    than ``TopTools_IndexedMapOfShape`` to keep this binding-independent.
    """
    seen = ShapeIndex()
    for sub in iter_shapes(shape, shape_type):
        before = len(seen)
        seen.identify(sub)
        if len(seen) > before:
            yield sub


def set_static_cval(name: str, value: str) -> bool:
    """``Interface_Static::SetCVal`` across bindings; True when it took effect.

    OCP exposes this as ``SetCVal_s`` and pythonocc as ``SetCVal``, so the bare
    attribute lookup silently misses on one of them - and a missed unit setting
    is invisible, not fatal: the reader keeps the file's own unit and every
    ``*_mm`` field quietly carries inches. Callers check the return value.
    """
    if Interface_Static is None:
        return False
    fn = _resolve_static((Interface_Static,), "SetCVal")
    if fn is None:
        return False
    # OCCT returns False when the static is not defined yet - the parameter is
    # only registered once the relevant controller has been initialised, so
    # this must be called after the reader exists, not before.
    return bool(fn(name, value))


def brep_read_fn():
    """``BRepTools::Read`` across bindings, or ``None`` when unavailable."""
    return _resolve_static((breptools, BRepTools), "Read")


def read_brep(shape: Any, path: str, builder: Any) -> Any:
    """``BRepTools::Read`` -> the reader's return value (``False`` on failure)."""
    fn = brep_read_fn()
    if fn is None:
        raise KernelUnavailable("BRepTools.Read unavailable in this binding")
    return fn(shape, path, builder)
