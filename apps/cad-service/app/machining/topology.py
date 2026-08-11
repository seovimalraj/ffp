"""Topology extraction: one traversal of the B-Rep into a :class:`ShapeModel`."""

from __future__ import annotations

import logging
import math
from typing import Any, Dict, List, Optional, Set, Tuple

from . import occ
from .config import MachiningConfig
from .faces import FaceClassifier
from .records import EdgeRecord, MassProperties, ShapeModel
from .schemas import AnalysisWarning, TopologyInfo, WarningCode
from .vectors import Vec, normalize

logger = logging.getLogger(__name__)

#: Points sampled per free-form edge for helix recognition.
_EDGE_SAMPLE_COUNT = 12


def _pnt(p: Any) -> Vec:
    return (float(p.X()), float(p.Y()), float(p.Z()))


class TopologyAnalyzer:
    """Flattens a ``TopoDS_Shape`` into the kernel-independent intermediate form."""

    def __init__(self, config: MachiningConfig):
        self.config = config
        self.face_classifier = FaceClassifier(config)

    # -- build -------------------------------------------------------------

    def build(self, shape: Any) -> ShapeModel:
        occ.require_kernel()
        model = ShapeModel(_occ_shape=shape)

        self._count_topology(shape, model)
        self._fill_bbox(shape, model)
        face_handles = self._build_faces(shape, model)
        self._build_edges_and_adjacency(shape, model, face_handles)
        return model

    def _count_topology(self, shape: Any, model: ShapeModel) -> None:
        model.solid_count = sum(1 for _ in occ.iter_unique_shapes(shape, occ.TopAbs_SOLID))
        model.shell_count = sum(1 for _ in occ.iter_unique_shapes(shape, occ.TopAbs_SHELL))
        model.wire_count = sum(1 for _ in occ.iter_unique_shapes(shape, occ.TopAbs_WIRE))
        model.vertex_count = sum(
            1 for _ in occ.iter_unique_shapes(shape, occ.TopAbs_VERTEX)
        )
        model.compound_count = sum(
            1 for _ in occ.iter_unique_shapes(shape, occ.TopAbs_COMPOUND)
        )

    def _fill_bbox(self, shape: Any, model: ShapeModel) -> None:
        try:
            box = occ.Bnd_Box()
            occ.add_to_bbox(shape, box, False)
            xmin, ymin, zmin, xmax, ymax, zmax = box.Get()
            model.bbox_min = (float(xmin), float(ymin), float(zmin))
            model.bbox_max = (float(xmax), float(ymax), float(zmax))
        except Exception as exc:
            logger.warning("Model bounding box failed: %s", exc)

    def _face_key(self, face: Any) -> Any:
        """Orientation-independent identity for a face, valid in both bindings.

        Orientation is deliberately excluded: the ancestors map hands back the
        same face with whatever orientation it carried inside its parent, and we
        need those to resolve to the one record we already created.
        """
        hash_code = getattr(face, "HashCode", None)
        if hash_code is not None:
            try:
                return int(hash_code(1 << 30))
            except Exception:
                pass
        # OCCT 7.8 / OCP dropped HashCode in favour of __hash__.
        try:
            return hash(face)
        except Exception:
            return id(face)

    def _solid_index_map(self, shape: Any) -> Dict[Any, int]:
        """Map each face identity to the index of the solid that owns it."""
        mapping: Dict[Any, int] = {}
        for index, solid in enumerate(occ.iter_unique_shapes(shape, occ.TopAbs_SOLID)):
            for face in occ.iter_unique_shapes(solid, occ.TopAbs_FACE):
                mapping.setdefault(self._face_key(face), index)
        return mapping

    def _build_faces(self, shape: Any, model: ShapeModel) -> Dict[Any, int]:
        """Classify every face; return a face-identity -> face_id lookup."""
        solid_lookup = self._solid_index_map(shape)
        handles: Dict[Any, int] = {}

        for face_id, raw in enumerate(occ.iter_unique_shapes(shape, occ.TopAbs_FACE), start=1):
            face = occ.to_face(raw)
            key = self._face_key(face)
            solid_index = solid_lookup.get(key, 0)
            try:
                record = self.face_classifier.classify(face, face_id, solid_index)
            except Exception as exc:
                logger.warning("Face %s classification failed: %s", face_id, exc)
                from .records import FaceRecord

                record = FaceRecord(id=face_id, solid_index=solid_index)
            model.faces[face_id] = record
            model._occ_faces[face_id] = face
            handles[key] = face_id
        return handles

    # -- edges -------------------------------------------------------------

    def _build_edges_and_adjacency(
        self, shape: Any, model: ShapeModel, face_handles: Dict[Any, int]
    ) -> None:
        try:
            edge_face_map = occ.map_shapes_and_ancestors(
                shape, occ.TopAbs_EDGE, occ.TopAbs_FACE
            )
        except Exception as exc:
            logger.warning("Edge/face adjacency map failed: %s", exc)
            return

        for index in range(1, edge_face_map.Extent() + 1):
            edge = occ.to_edge(edge_face_map.FindKey(index))
            record = self._classify_edge(edge, index)

            parent_faces = self._faces_of(edge_face_map.FindFromIndex(index), face_handles)
            record.face_ids = sorted(set(parent_faces))
            record.is_seam = len(parent_faces) != len(set(parent_faces))

            model.edges[index] = record
            for face_id in record.face_ids:
                model.faces[face_id].edge_ids.append(index)
                model.face_neighbors.setdefault(face_id, set())

            for i, a in enumerate(record.face_ids):
                for b in record.face_ids[i + 1 :]:
                    model.face_neighbors.setdefault(a, set()).add(b)
                    model.face_neighbors.setdefault(b, set()).add(a)
                    key = (a, b) if a <= b else (b, a)
                    model.shared_edges.setdefault(key, []).append(index)

    def _iter_shape_list(self, shape_list: Any):
        """Iterate a ``TopTools_ListOfShape`` across both bindings."""
        try:
            yield from iter(shape_list)
            return
        except TypeError:
            pass
        import importlib

        root = "OCP" if occ.kernel_name() == "OCP" else "OCC.Core"
        mod = importlib.import_module(f"{root}.TopTools")
        it_cls = getattr(mod, "TopTools_ListIteratorOfListOfShape", None)
        if it_cls is None:  # pragma: no cover - binding dependent
            return
        it = it_cls(shape_list)
        while it.More():
            yield it.Value()
            it.Next()

    def _faces_of(self, face_list: Any, face_handles: Dict[Any, int]) -> List[int]:
        """Resolve an edge's parent-face list to our face ids."""
        found: List[int] = []
        for raw in self._iter_shape_list(face_list):
            face_id = face_handles.get(self._face_key(occ.to_face(raw)))
            if face_id is not None:
                found.append(face_id)
        return found

    def _classify_edge(self, edge: Any, edge_id: int) -> EdgeRecord:
        record = EdgeRecord(id=edge_id)
        try:
            curve = occ.BRepAdaptor_Curve(edge)
        except Exception:
            return record

        try:
            curve_type = curve.GetType()
            if curve_type == occ.GeomAbs_Line:
                record.curve_type = "LINE"
            elif curve_type == occ.GeomAbs_Circle:
                record.curve_type = "CIRCLE"
                circle = curve.Circle()
                record.radius_mm = float(circle.Radius())
                record.axis = normalize(
                    (
                        float(circle.Axis().Direction().X()),
                        float(circle.Axis().Direction().Y()),
                        float(circle.Axis().Direction().Z()),
                    )
                )
            elif curve_type == occ.GeomAbs_Ellipse:
                record.curve_type = "ELLIPSE"
            elif curve_type == occ.GeomAbs_BSplineCurve:
                record.curve_type = "BSPLINE"
            else:
                record.curve_type = "OTHER"
        except Exception:
            pass

        try:
            first, last = curve.FirstParameter(), curve.LastParameter()
            record.start = _pnt(curve.Value(first))
            record.end = _pnt(curve.Value(last))
            record.midpoint = _pnt(curve.Value((first + last) / 2.0))
            record.is_closed = (
                abs(record.start[0] - record.end[0]) < self.config.linear_tolerance_mm
                and abs(record.start[1] - record.end[1]) < self.config.linear_tolerance_mm
                and abs(record.start[2] - record.end[2]) < self.config.linear_tolerance_mm
            )
            if record.curve_type in ("BSPLINE", "OTHER", "ELLIPSE"):
                record.samples = [
                    _pnt(curve.Value(first + (last - first) * i / (_EDGE_SAMPLE_COUNT - 1)))
                    for i in range(_EDGE_SAMPLE_COUNT)
                ]
        except Exception as exc:
            logger.debug("Edge %s sampling failed: %s", edge_id, exc)

        try:
            props = occ.linear_props(edge)
            record.length_mm = float(props.Mass())
        except Exception:
            pass

        return record

    # -- reporting ---------------------------------------------------------

    def summarize(
        self, shape: Any, model: ShapeModel, warnings: List[AnalysisWarning]
    ) -> TopologyInfo:
        """Build the public topology block and flag open shells."""
        info = TopologyInfo()

        try:
            for solid in occ.iter_unique_shapes(shape, occ.TopAbs_SOLID):
                info.faces_per_solid.append(
                    sum(1 for _ in occ.iter_unique_shapes(solid, occ.TopAbs_FACE))
                )
        except Exception as exc:
            logger.debug("faces_per_solid failed: %s", exc)

        try:
            for shell in occ.iter_unique_shapes(shape, occ.TopAbs_SHELL):
                if bool(shell.Closed()):
                    info.closed_shell_count += 1
                else:
                    info.open_shell_count += 1
        except Exception as exc:
            logger.debug("shell closure check failed: %s", exc)

        info.free_edge_count = sum(1 for e in model.edges.values() if e.is_free)
        info.seam_edge_count = sum(1 for e in model.edges.values() if e.is_seam)
        info.max_faces_per_edge = max(
            (len(e.face_ids) for e in model.edges.values()), default=0
        )
        info.euler_characteristic = (
            model.vertex_count - len(model.edges) + len(model.faces)
        )

        if info.open_shell_count or info.free_edge_count:
            warnings.append(
                AnalysisWarning(
                    code=WarningCode.OPEN_SHELL,
                    message=(
                        f"{info.open_shell_count} open shell(s) and "
                        f"{info.free_edge_count} unshared edge(s) found. Feature "
                        "detection that relies on face adjacency may be incomplete."
                    ),
                    detail={
                        "open_shell_count": info.open_shell_count,
                        "free_edge_count": info.free_edge_count,
                    },
                )
            )
        return info


class GeometryAnalyzer:
    """Kernel mass properties: volume, area, centre of mass, inertia."""

    def __init__(self, config: MachiningConfig):
        self.config = config

    def analyze(self, shape: Any) -> MassProperties:
        occ.require_kernel()
        props = MassProperties()

        try:
            volume = occ.volume_props(shape)
            props.volume_mm3 = float(volume.Mass())
            props.center_of_mass = _pnt(volume.CentreOfMass())
            self._fill_inertia(volume, props)
        except Exception as exc:
            logger.warning("Volume properties failed: %s", exc)
            props.is_closed_volume = False

        try:
            props.surface_area_mm2 = occ.surface_props(shape)
        except Exception as exc:
            logger.warning("Surface properties failed: %s", exc)

        # A negative or zero volume means the solid is not correctly oriented
        # or not closed - report it rather than emitting a nonsense number.
        if props.volume_mm3 <= 0:
            props.is_closed_volume = False
            props.volume_mm3 = abs(props.volume_mm3)

        return props

    def _fill_inertia(self, volume: Any, props: MassProperties) -> None:
        try:
            matrix = volume.MatrixOfInertia()
            props.ixx = float(matrix.Value(1, 1))
            props.iyy = float(matrix.Value(2, 2))
            props.izz = float(matrix.Value(3, 3))
            props.ixy = float(matrix.Value(1, 2))
            props.ixz = float(matrix.Value(1, 3))
            props.iyz = float(matrix.Value(2, 3))
        except Exception as exc:
            logger.debug("Inertia matrix unavailable: %s", exc)
            return

        try:
            principal = volume.PrincipalProperties()
            moments = principal.Moments()
            props.principal = [float(m) for m in moments]
        except Exception as exc:
            logger.debug("Principal moments unavailable: %s", exc)
