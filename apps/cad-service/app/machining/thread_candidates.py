"""Heuristic tap-drill-diameter matching for holes.

This is deliberately separate from :mod:`app.machining.detectors.threads`.
That module claims a thread only from CAD metadata or modelled helical
geometry - real evidence. This module does the opposite: it flags a hole as a
*candidate* for tapping purely because its diameter happens to sit at a
standard tap-drill size, which is a coincidence-of-diameter observation, not a
measured fact. See :class:`app.machining.schemas.ThreadCandidate` for the
non-negotiable separation from `ThreadFeature`/`ThreadConfidence`.

Tap-drill formula and source
-----------------------------
For an ISO metric thread, the conventional tap-drill diameter for
(approximately) 75% thread engagement is::

    tap_drill_mm ~= nominal_diameter_mm - pitch_mm

This is the standard rule of thumb given in machinists' references (e.g.
Machinery's Handbook's "seventy-five percent thread" discussion, and the same
convention DIN/ISO shop tap-drill charts use) for coarse and fine ISO metric
series alike. The table below uses the actual published standard tap-drill
values from those charts rather than the raw formula, because for a couple of
sizes (M8 and M12 coarse) the widely-published standard value is rounded 0.05
mm away from the bare `nominal - pitch` arithmetic - and matching the value a
real drawing or shop chart would actually state is the point of a diameter
heuristic like this one. Every value below still equals `nominal - pitch` to
within that same 0.05 mm.

It is an approximation, not an exact geometric fact - which is exactly why
this whole module is a heuristic and not a measurement. The table covers the
common coarse and fine ISO metric sizes M3-M24; it is not exhaustive of every
ISO thread size ever cut, only the sizes a shop is likely to actually tap.
"""

from __future__ import annotations

from typing import Dict, List, NamedTuple, Optional

from .schemas import ThreadCandidate, ThreadCandidateConfidence


class _TapDrillEntry(NamedTuple):
    designation: str
    nominal_diameter_mm: float
    pitch_mm: float
    drill_diameter_mm: float


#: ISO metric coarse-pitch series, M3 through M24: nominal -> (pitch, standard
#: published tap-drill diameter for ~75% thread engagement).
_COARSE_SERIES: Dict[float, tuple] = {
    3.0: (0.5, 2.5),
    4.0: (0.7, 3.3),
    5.0: (0.8, 4.2),
    6.0: (1.0, 5.0),
    8.0: (1.25, 6.8),
    10.0: (1.5, 8.5),
    12.0: (1.75, 10.2),
    14.0: (2.0, 12.0),
    16.0: (2.0, 14.0),
    18.0: (2.5, 15.5),
    20.0: (2.5, 17.5),
    22.0: (2.5, 19.5),
    24.0: (3.0, 21.0),
}

#: ISO metric fine-pitch series commonly stocked/tapped, M8 through M24:
#: nominal -> (pitch, standard published tap-drill diameter).
_FINE_SERIES: Dict[float, tuple] = {
    8.0: (1.0, 7.0),
    10.0: (1.25, 8.8),
    12.0: (1.5, 10.5),
    14.0: (1.5, 12.5),
    16.0: (1.5, 14.5),
    18.0: (1.5, 16.5),
    20.0: (1.5, 18.5),
    22.0: (1.5, 20.5),
    24.0: (2.0, 22.0),
}


def _build_table() -> List[_TapDrillEntry]:
    entries: List[_TapDrillEntry] = []
    for nominal, (pitch, drill) in _COARSE_SERIES.items():
        entries.append(_TapDrillEntry(f"M{nominal:g}x{pitch:g}", nominal, pitch, drill))
    for nominal, (pitch, drill) in _FINE_SERIES.items():
        if _COARSE_SERIES.get(nominal) == (pitch, drill):
            continue  # already covered by the coarse entry
        entries.append(_TapDrillEntry(f"M{nominal:g}x{pitch:g}", nominal, pitch, drill))
    return entries


#: Precomputed once at import time - the table is fixed, pure data.
TAP_DRILL_TABLE: List[_TapDrillEntry] = _build_table()


def match_tap_drill(
    diameter_mm: float, tolerance_mm: float = 0.05
) -> Optional[ThreadCandidate]:
    """Return a :class:`ThreadCandidate` when ``diameter_mm`` matches a standard
    ISO metric tap-drill size within ``tolerance_mm``, else ``None``.

    Pure function: no geometry, no kernel, easily unit-tested standalone.
    When several table entries fall within tolerance (coarse and fine series
    can be close for some sizes), the closest match wins.
    """
    best: Optional[_TapDrillEntry] = None
    best_delta = tolerance_mm
    for entry in TAP_DRILL_TABLE:
        delta = abs(diameter_mm - entry.drill_diameter_mm)
        if delta <= tolerance_mm and delta <= best_delta:
            best = entry
            best_delta = delta

    if best is None:
        return None

    return ThreadCandidate(
        designation=best.designation,
        confidence=ThreadCandidateConfidence.HEURISTIC,
        note=(
            f"Diameter matches the standard {best.designation} tap-drill size "
            f"({best.drill_diameter_mm:g}mm); not confirmed by CAD metadata or "
            "geometry - verify before assuming this hole is threaded."
        ),
    )
