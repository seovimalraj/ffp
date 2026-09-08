"""Bend-relief detection - conservative stub for this phase.

Per design doc section 9 ("open questions"): the legacy codebase has no
relief-notch detector to port from, and a from-scratch geometric detector
(rectangular/round notch adjacent to a bend-line endpoint) is explicitly
called out as risky to ship reliably within this phase. The chosen default
is a documented stub: one ``BendRelief`` record per detected bend, typed
``"none-detected"`` with a clear ``note`` explaining that relief detection is
not yet implemented - never silently omitting the field, and never a hard
failure.

A future phase can replace this wholesale once a real detector exists;
nothing downstream should assume a ``"none-detected"`` record means "this
part has no relief cuts" - it means "this was not checked".
"""

from __future__ import annotations

from typing import List

from ..schemas import BendFeature, BendRelief

NOT_IMPLEMENTED_NOTE = (
    "Bend-relief detection is not yet implemented (see design doc section 9); "
    "this is a placeholder, not a geometric finding. The absence of a "
    "detected relief here does not mean the part has none."
)


def detect_bend_reliefs(bends: List[BendFeature]) -> List[BendRelief]:
    """One conservative "none-detected" stub record per bend.

    Never raises - if ``bends`` is empty this returns an empty list, matching
    the rest of this phase's "no bends -> no bend-relief records" behaviour.
    """
    return [
        BendRelief(
            id=f"relief_{bend.id}",
            bend_id=bend.id,
            type="none-detected",
            width_mm=None,
            depth_mm=None,
            position=None,
            note=NOT_IMPLEMENTED_NOTE,
        )
        for bend in bends
    ]
