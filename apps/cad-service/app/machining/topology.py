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
        self._build_faces(shape, model)
        self._build_edges_and_adjacency(model)
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

    def _solid_index_map(self, shape: Any, faces: occ.ShapeIndex) -> Dict[int, int]:
        """Map each face identity to the index of the solid that owns it."""
        mapping: Dict[int, int] = {}
        for index, solid in enumerate(occ.iter_unique_shapes(shape, occ.TopAbs_SOLID)):
            for face in occ.iter_unique_shapes(solid, occ.TopAbs_FACE):
                mapping.setdefault(faces.identify(face), index)
        return mapping

    def _build_faces(self, shape: Any, model: ShapeModel) -> occ.ShapeIndex:
        """Classify every face; return the index that identifies them."""
        faces = occ.ShapeIndex()
        solid_lookup = self._solid_index_map(shape, faces)

        for face_id, raw in enumerate(occ.iter_unique_shapes(shape, occ.TopAbs_FACE), start=1):
            face = occ.to_face(raw)
            solid_index = solid_lookup.get(faces.identify(face), 0)
            try:
                record = self.face_classifier.classify(face, face_id, solid_index)
            except Exception as exc:
                logger.warning("Face %s classification failed: %s", face_id, exc)
                from .records import FaceRecord

                record = FaceRecord(id=face_id, solid_index=solid_index)
            model.faces[face_id] = record
            model._occ_faces[face_id] = face
        return faces

    # -- edges -------------------------------------------------------------

    def _build_edges_and_adjacency(self, model: ShapeModel) -> None:
        """Index every edge and record which faces meet along it.

        Built by walking each face's own edges rather than by asking OCCT for an
        edge->ancestors map. The map route needs ``TopExp::MapShapesAndAncestors``
        plus index-based access to ``TopTools_IndexedDataMapOfShapeListOfShape``,
        and the two bindings disagree about which of ``Extent``/``Size`` that
        collection exposes. Face traversal needs only ``TopExp_Explorer``, which
        behaves identically everywhere, and yields the same adjacency.
        """
        # Shared edges are reached once per adjoining face, so accumulate by
        # edge identity and let repeats build the adjacency.
        edges = occ.ShapeIndex()
        faces_by_edge: Dict[int, List[int]] = {}
        edge_handles: Dict[int, Any] = {}
        edge_order: List[int] = []

        for face_id in sorted(model._occ_faces):
            face = model._occ_faces[face_id]
            for raw_edge in occ.iter_shapes(face, occ.TopAbs_EDGE):
                edge = occ.to_edge(raw_edge)
                key = edges.identify(edge)
                if key not in faces_by_edge:
                    faces_by_edge[key] = []
                    edge_handles[key] = edge
                    edge_order.append(key)
                faces_by_edge[key].append(face_id)

        for index, key in enumerate(edge_order, start=1):
            record = self._classify_edge(edge_handles[key], index)

            parents = faces_by_edge[key]
            record.face_ids = sorted(set(parents))
            # A seam edge is reached twice from the *same* face - it is the
            # closing line of a periodic surface, not a shell boundary.
            record.is_seam = len(parents) != len(record.face_ids)

            model.edges[index] = record
            for face_id in record.face_ids:
                model.faces[face_id].edge_ids.append(index)
                model.face_neighbors.setdefault(face_id, set())

            for position, a in enumerate(record.face_ids):
                for b in record.face_ids[position + 1 :]:
                    model.face_neighbors.setdefault(a, set()).add(b)
                    model.face_neighbors.setdefault(b, set()).add(a)
                    pair = (a, b) if a <= b else (b, a)
                    model.shared_edges.setdefault(pair, []).append(index)

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
