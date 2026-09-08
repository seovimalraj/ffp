"""Folded-edge (hem) classification - a narrow, honest heuristic.

No reference implementation exists to port (same situation
:mod:`app.sheet_metal.detectors.bend_relief` documents for relief notches):
the legacy codebase has no hem detector. A fully general hem detector would
need to reconstruct the flat pattern to tell "this is a 180 degree fold back
onto the same flange" apart from "this is an ordinary bend to a new flange",
which is out of scope for this phase (flat-pattern unfolding is explicitly
deferred per the design doc's non-goals). What ships here instead is a
narrower, geometry-only heuristic, documented clearly so nothing downstream
mistakes it for a complete hem detector:

Heuristic
---------
A hem is modelled as a cylindrical transition face where the material folds
back *onto itself* rather than *out to a second flange*:

1. Small radius: at or below 1.5x the sheet thickness (a press-brake bend
   joining two flanges normally uses a radius comparable to or larger than
   the thickness; a hem curls the material back on a much tighter radius by
   definition - it is, after all, trying to close the gap to zero).
2. Only **one** planar neighbour, not two. :mod:`app.sheet_metal.detectors.bends`
   requires exactly two flange-joining planar neighbours (the two flat legs a
   bend connects); a hem's far side curls back to touch (or nearly touch) the
   *same* flange it started from, so the cylindrical face typically only ever
   picks up one distinct planar neighbour in the adjacency graph - the free,
   curled-back end has no further flange to be adjacent to.
3. A generous angular wrap (>= 150 degrees) - a hem wraps much further around
   than a simple corner blend.

The wrap angle then buckets the hem type: a small wrap (<200 deg) reads as
"open" (the material has curled but not folded back far), a wrap approaching
a full loop (200-340 deg) as "teardrop" (nearly closed, a small egg-shaped
gap remaining), and a near-360 deg wrap as "closed" (folded flat against the
flange).

Known limitations
------------------
- A hem built as two coincident flat skins with **no** dedicated cylindrical
  transition face (fully flattened, e.g. modelled as two overlapping thin
  plates with no explicit fold surface) is invisible to this heuristic - it
  looks like an ordinary thin paired wall to the rest of the pipeline.
- A tight-radius bend that happens to have only one flange neighbour for
  unrelated modelling reasons (a trimmed/incomplete solid, a fillet at a free
  edge with no counterpart face) can be misclassified as a hem. This is the
  same class of risk :mod:`bend_relief` calls out for its own stub - a
  heuristic classification, not a verified one.
- No attempt is made to distinguish a hem from a rolled/curled free edge that
  is not a manufacturing hem at all (e.g. a decorative bead). Confidence is
  intentionally not exposed on :class:`~app.sheet_metal.schemas.Hem` (the
  schema has no such field); this note is the documented substitute.
"""

from __future__ import annotations

from typing import List, Optional

from ...machining.records import CYLINDER, PLANE, ShapeModel
from ..config import SheetMetalConfig
from ..schemas import Hem, Vector3

#: Minimum angular wrap (degrees) to be considered "folded back" rather than
#: an ordinary corner blend.
_MIN_WRAP_DEG = 150.0

#: Radius must be at or below this multiple of sheet thickness.
_MAX_RADIUS_TO_THICKNESS_RATIO = 1.5


def _classify_wrap(wrap_deg: float) -> str:
    if wrap_deg < 200.0:
        return "open"
    if wrap_deg < 340.0:
        return "teardrop"
    return "closed"


def detect_hems(
    model: ShapeModel,
    config: SheetMetalConfig,
    thickness_mm: Optional[float] = None,
) -> List[Hem]:
    """Detect folded-edge (hem) candidates using the heuristic above.

    Never raises: geometry with no qualifying cylindrical faces returns an
    empty list. When ``thickness_mm`` is unknown, ``config.max_sheet_thickness_mm``
    is used as a conservative stand-in for the radius-limit calculation so the
    detector still runs (rather than being skipped outright) on a part whose
    thickness detection failed.
    """
    reference_thickness = thickness_mm if thickness_mm and thickness_mm > 0 else config.max_sheet_thickness_mm
    radius_limit = reference_thickness * _MAX_RADIUS_TO_THICKNESS_RATIO

    hems: List[Hem] = []
    cylinders = sorted(
        (f for f in model.faces.values() if f.surface_type == CYLINDER and f.radius_mm),
        key=lambda f: f.id,
    )
    for cyl in cylinders:
        if cyl.radius_mm is None or cyl.radius_mm <= 0 or cyl.radius_mm > radius_limit:
            continue

        wrap = cyl.angular_span_deg if cyl.angular_span_deg is not None else 360.0
        if wrap < _MIN_WRAP_DEG:
            continue

        planar_neighbors = [
            n for n in model.neighbors(cyl.id) if n.surface_type == PLANE and n.normal is not None
        ]
        if len(planar_neighbors) != 1:
            continue  # two neighbours is a bend (bends.py's territory)

        flange = planar_neighbors[0]
        hem_type = _classify_wrap(wrap)
        length_mm = cyl.axial_extent_mm or 0.0

        hems.append(
            Hem(
                id=f"HEM-{len(hems) + 1:03d}",
                type=hem_type,
                length_mm=round(length_mm, config.length_decimals),
                position=Vector3(
                    x=round(cyl.centroid[0], config.length_decimals),
                    y=round(cyl.centroid[1], config.length_decimals),
                    z=round(cyl.centroid[2], config.length_decimals),
                ),
                adjacent_flange_id=str(flange.id),
            )
        )
    return hems
