"""Elongated pierced profile ("slot") detection.

Adapted from ``app.machining.detectors.slots.SlotDetector``'s core idea -
split slot-shaped profiles out from general cutouts by aspect ratio - but
built on this package's own inner-profile-loop reconstruction
(:mod:`app.sheet_metal.detectors.cutouts`) rather than machining's
recessed-pocket-floor candidates, since a sheet-metal slot is a pierced
profile with no floor at all.

A profile qualifies as a slot when its long/short in-plane extent ratio meets
:data:`app.sheet_metal.detectors.cutouts.SLOT_MIN_ASPECT_RATIO` *and* at
least one of its bounding edges is curved (an arc end) - see
``cutouts.is_slot_like`` for the exact test, shared so ``cutouts.py`` never
double-reports a profile this module already claimed.

``corner_radius_mm`` is the radius of the rounded end(s), taken from the
loop's circular edges (average, when both ends are rounded and differ
slightly due to modelling tolerance).
"""

from __future__ import annotations

from typing import List, Optional

from ...machining.records import PLANE, ShapeModel
from ..config import SheetMetalConfig
from ..schemas import SheetMetalSlot, Vector3
from .cutouts import (
    inner_profile_loops,
    is_slot_like,
    profile_metrics,
)


def _corner_radius(chain) -> Optional[float]:
    radii = [edge.radius_mm for edge in chain if edge.curve_type == "CIRCLE" and edge.radius_mm]
    if not radii:
        return None
    return sum(radii) / len(radii)


def detect_slots(model: ShapeModel, config: SheetMetalConfig) -> List[SheetMetalSlot]:
    """Detect elongated pierced profiles with rounded ends.

    Never raises: no qualifying inner loops simply yields an empty list.
    """
    slots: List[SheetMetalSlot] = []
    for face in sorted(model.faces_of_type(PLANE), key=lambda f: f.id):
        if face.normal is None or not face.edge_ids:
            continue
        for chain in inner_profile_loops(model, face):
            if not is_slot_like(face, chain, config):
                continue

            perimeter, area, extent_long, extent_short, centroid = profile_metrics(
                face, chain
            )
            # A rough long-axis direction: the face's own u/v basis vector
            # that carried the longer projected extent. Recomputed here
            # (cheaply) rather than threading it back out of profile_metrics,
            # which only reports scalar extents.
            from ...machining.vectors import dot, perpendicular_basis

            u, v = perpendicular_basis(face.normal)
            points = [chain[0].start, chain[0].end]
            us = [dot(p, u) for p in points]
            vs = [dot(p, v) for p in points]
            long_axis = u if (max(us) - min(us)) >= (max(vs) - min(vs)) else v

            slots.append(
                SheetMetalSlot(
                    id=f"SLOT-{len(slots) + 1:03d}",
                    length_mm=round(extent_long, config.length_decimals),
                    width_mm=round(extent_short, config.length_decimals),
                    corner_radius_mm=(
                        round(r, config.length_decimals)
                        if (r := _corner_radius(chain)) is not None
                        else None
                    ),
                    orientation=Vector3(x=long_axis[0], y=long_axis[1], z=long_axis[2]),
                    position=Vector3(
                        x=round(centroid[0], config.length_decimals),
                        y=round(centroid[1], config.length_decimals),
                        z=round(centroid[2], config.length_decimals),
                    ),
                    distance_to_nearest_bend_mm=None,
                )
            )
    return slots
