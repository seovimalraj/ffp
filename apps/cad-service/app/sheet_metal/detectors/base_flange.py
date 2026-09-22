"""Base face + flange face identification.

A sheet-metal part's "base" is simply its largest planar skin face. A flange
is a flat panel reachable from the base by chaining through one or more
*detected bends* - not merely any planar face whose own paired-wall gap
happens to match the part's dominant thickness.

That second, weaker test was this module's original definition, and it is
wrong: the dominant-thickness clustering in
:mod:`app.sheet_metal.detectors.sheet_candidate` is global - it clusters every
opposed planar pair on the *whole part* by gap, with no regard for whether
the two faces are physically part of the same contiguous wall system. A
genuinely formed feature elsewhere on the part - an embossed rib, a drawn
boss, a stamped grille housing - keeps the sheet's own thickness by
construction, so its own two skins land in the *same* dominant-thickness
cluster as the base/flange system and were, before this fix, silently swept
into ``flange_faces`` too. Downstream, ``detect_formed_features`` excludes
every ``flange_faces`` id from its candidate search, so that feature was
never even considered - not rejected, just never reached. (Confirmed on a
real part: a grille-topped collar's floor face, offset from its surrounding
panel by exactly the sheet's ~2mm thickness, appeared in ``flange_faces``
with no formed feature ever detected there.)

Bend detection (:mod:`app.sheet_metal.detectors.bends`) already identifies,
for each bend, the exact pair of planar faces it joins
(``BendFeature.adjacent_flange_ids``) - geometric adjacency evidence (a
shared axis-parallel edge, an angle inside the configured bend window), not
a same-gap-anywhere match. This module now builds ``flange_faces`` by
graph-searching that bend adjacency starting from the base face, so only
faces actually connected to the base through a real fold count. Bend
detection has no dependency on this module's output (it works directly from
cylindrical faces in the model), so it runs first in the pipeline - see
``service.py``'s stage ordering.

The dominant-thickness pairing from ``sheet_candidate`` is kept for exactly
one purpose now: picking *which* face is the base (the largest face in the
part's dominant wall-thickness system, when one exists) - not for deciding
what counts as a flange.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Dict, List, Optional, Sequence, Set

from ...machining.records import ShapeModel
from ...machining.schemas import Vector3
from ..config import SheetMetalConfig
from ..schemas import FlangeFace, SheetMetalFaces
from .sheet_candidate import cluster_pairs, dominant_cluster, find_opposed_planar_pairs

if TYPE_CHECKING:
    from ..schemas import BendFeature

#: Same clustering tolerance family used by sheet_candidate/thickness.
_CLUSTER_TOL_ABS_MM = 0.1


def _pick_base_id(model: ShapeModel, config: SheetMetalConfig) -> Optional[int]:
    """The largest face in the part's dominant wall-thickness pairing system.

    Falls back to the largest planar face in the whole model when no opposed
    pair exists at all (e.g. a rejected sheet-metal candidate), so a base is
    always reported when any planar face is.
    """
    max_gap = config.max_sheet_thickness_mm * 1.5
    pairs = find_opposed_planar_pairs(model, min_gap=config.linear_tolerance_mm, max_gap=max_gap)

    wall_face_areas: Dict[int, float] = {}
    if pairs:
        clusters = cluster_pairs(pairs, tol_mm=max(_CLUSTER_TOL_ABS_MM, config.linear_tolerance_mm))
        dominant = dominant_cluster(clusters)
        if dominant is not None:
            for pair in dominant.pairs:
                wall_face_areas[pair.face_a.id] = pair.face_a.area_mm2
                wall_face_areas[pair.face_b.id] = pair.face_b.area_mm2

    if wall_face_areas:
        return max(wall_face_areas, key=lambda fid: wall_face_areas[fid])

    planar = [f for f in model.faces.values() if f.normal is not None]
    if not planar:
        return None
    return max(planar, key=lambda f: f.area_mm2).id


def _reachable_via_bends(base_id: int, bends: Sequence["BendFeature"]) -> Set[int]:
    """Face ids reachable from ``base_id`` by chaining through bend joints."""
    graph: Dict[int, Set[int]] = {}
    for bend in bends:
        if len(bend.adjacent_flange_ids) != 2:
            continue
        try:
            a, b = (int(fid) for fid in bend.adjacent_flange_ids)
        except ValueError:
            continue
        graph.setdefault(a, set()).add(b)
        graph.setdefault(b, set()).add(a)

    reachable: Set[int] = set()
    frontier = [base_id]
    while frontier:
        node = frontier.pop()
        for neighbor in graph.get(node, ()):
            if neighbor == base_id or neighbor in reachable:
                continue
            reachable.add(neighbor)
            frontier.append(neighbor)
    return reachable


def detect_base_flange(
    model: ShapeModel, config: SheetMetalConfig, bends: Sequence["BendFeature"] = ()
) -> SheetMetalFaces:
    """Identify the base face and every flange reachable from it via a bend.

    Never raises: no planar faces at all is the only case with no base
    (``base_face_id=None``); no bends means no flanges, which is correct for
    a flat, unformed part - not a detector failure.
    """
    base_id = _pick_base_id(model, config)
    if base_id is None:
        return SheetMetalFaces(base_face_id=None, flange_faces=[])

    flange_faces: List[FlangeFace] = []
    for face_id in sorted(_reachable_via_bends(base_id, bends)):
        face = model.faces.get(face_id)
        if face is None or face.normal is None:
            continue
        flange_faces.append(
            FlangeFace(
                face_id=face.id,
                area_mm2=round(face.area_mm2, config.area_decimals),
                plane_normal=Vector3(x=face.normal[0], y=face.normal[1], z=face.normal[2]),
                adjacent_bend_ids=[],
            )
        )

    return SheetMetalFaces(base_face_id=base_id, flange_faces=flange_faces)
