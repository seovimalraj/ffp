"""Outer profile perimeter + closed-loop validity.

Rather than re-deriving loop reconstruction (chaining edges end-to-end into
closed wires), this is a thin wrapper over
:mod:`app.sheet_metal.detectors.cutouts`'s already-working ``face_loops`` /
outer-loop-selection logic (see that module's docstring: the outer loop of a
planar face's edge set is identified as the loop with the largest
bounding-box diagonal). The "outer profile" of the whole part is scoped here
to the base face's outer boundary - the flat pattern's silhouette lives on the
base skin, and every flange is joined to it through a bend, not through the
same planar face - which is consistent with this phase's documented decision
to treat full multi-face flat-pattern reconstruction as out of scope (that is
what the deferred flat-pattern-unfolding spec would need to do properly).

:func:`select_outer_loop` is exported so :mod:`app.sheet_metal.distance_checks`
and :mod:`app.sheet_metal.patterns` (symmetry) can measure against the same
raw edge loop rather than re-deriving it a second time.
"""

from __future__ import annotations

from typing import List, Optional

from ...machining.records import PLANE, FaceRecord, ShapeModel
from ..config import SheetMetalConfig
from ..schemas import OuterProfile, ProfileValidityIssue, SheetMetalFaces
from .cutouts import Loop, _loop_bbox_diagonal, _point_key, face_loops


def _select_profile_face(model: ShapeModel, faces: SheetMetalFaces) -> Optional[FaceRecord]:
    """The face whose outer boundary stands in for the part's outer profile.

    Prefers the already-identified base face (stage 7); falls back to the
    largest planar face with edge data when no base face was resolved (e.g.
    the sheet-metal candidate gate was rejected but the pipeline still runs).
    """
    if faces.base_face_id is not None:
        face = model.faces.get(faces.base_face_id)
        if face is not None and face.normal is not None and face.edge_ids:
            return face

    candidates = [
        f for f in model.faces_of_type(PLANE) if f.normal is not None and f.edge_ids
    ]
    if not candidates:
        return None
    return max(candidates, key=lambda f: f.area_mm2)


def select_outer_loop(model: ShapeModel, faces: SheetMetalFaces) -> Optional[Loop]:
    """The raw edge chain forming the outer profile's boundary, or ``None``."""
    face = _select_profile_face(model, faces)
    if face is None:
        return None
    loops = face_loops(model, face)
    if not loops:
        return None
    return max(loops, key=_loop_bbox_diagonal)


def _loop_is_closed(loop: Loop) -> bool:
    if not loop:
        return False
    if len(loop) == 1 and loop[0].is_closed:
        return True
    first_start = _point_key(loop[0].start)
    last_end = _point_key(loop[-1].end)
    last_start = _point_key(loop[-1].start)
    return first_start == last_end or first_start == last_start


def detect_outer_profile(
    model: ShapeModel, config: SheetMetalConfig, faces: SheetMetalFaces
) -> OuterProfile:
    """Perimeter + closed-loop validity of the part's outer boundary.

    Never raises: geometry with no usable planar/edge data returns an
    ``OuterProfile`` with ``perimeter_mm``/``is_closed`` left ``None`` and a
    ``validity_issues`` entry explaining why, matching every other detector's
    "no hard failure" contract in this package.
    """
    loop = select_outer_loop(model, faces)
    if loop is None:
        return OuterProfile(
            perimeter_mm=None,
            is_closed=None,
            validity_issues=[
                ProfileValidityIssue(
                    code="NO_PROFILE_FACE",
                    message=(
                        "No planar face with resolvable edge data was available "
                        "to derive an outer profile."
                    ),
                )
            ],
        )

    perimeter = sum(edge.length_mm for edge in loop)
    is_closed = _loop_is_closed(loop)
    issues: List[ProfileValidityIssue] = []
    if not is_closed:
        issues.append(
            ProfileValidityIssue(
                code="OPEN_LOOP",
                message=(
                    "The outer boundary loop does not close back to its "
                    "starting point - the profile may be incomplete or the "
                    "part's boundary spans more than one face."
                ),
            )
        )

    return OuterProfile(
        perimeter_mm=round(perimeter, config.length_decimals),
        is_closed=is_closed,
        validity_issues=issues,
    )
