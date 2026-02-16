"""Grain direction analysis for sheet metal parts.

Recommends rolling/grain direction based on bend axes. Bending
perpendicular to the grain direction gives better ductility and reduces
cracking risk.
"""
from __future__ import annotations

import logging
import math
from typing import List, Tuple, Optional

from ..models import GrainDirectionInfo

logger = logging.getLogger(__name__)


def _normalize(v):
    mag = math.sqrt(sum(c * c for c in v))
    if mag < 1e-12:
        return (0.0, 0.0, 0.0)
    return tuple(c / mag for c in v)


def _cross(a, b):
    return (
        a[1] * b[2] - a[2] * b[1],
        a[2] * b[0] - a[0] * b[2],
        a[0] * b[1] - a[1] * b[0],
    )


def _dot(a, b):
    return sum(ai * bi for ai, bi in zip(a, b))


def _no_bend_direction(
    flat_length: float,
    flat_width: float,
) -> GrainDirectionInfo:
    """Return grain direction when no bends exist."""
    if flat_length >= flat_width and flat_length > 0:
        direction = (1.0, 0.0, 0.0)
        notes = "No bends detected; grain aligned with longest dimension (X)."
    elif flat_width > 0:
        direction = (0.0, 1.0, 0.0)
        notes = "No bends detected; grain aligned with longest dimension (Y)."
    else:
        direction = (1.0, 0.0, 0.0)
        notes = "Insufficient geometry; defaulting grain to X axis."
    return GrainDirectionInfo(
        recommended_direction=list(direction),
        bend_axes=[],
        alignment_score=0.5,
        notes=notes,
    )


def _single_bend_direction(
    axes: List[Tuple[float, float, float]],
) -> GrainDirectionInfo:
    """Return grain direction perpendicular to a single bend axis."""
    ax = axes[0]
    candidates = [(1.0, 0.0, 0.0), (0.0, 1.0, 0.0), (0.0, 0.0, 1.0)]
    best_dir = candidates[0]
    best_perp = 0.0
    for c in candidates:
        perp = 1.0 - abs(_dot(c, ax))
        if perp > best_perp:
            best_perp = perp
            best_dir = c

    grain = _normalize(_cross(ax, _cross(best_dir, ax)))
    if sum(c * c for c in grain) < 0.5:
        grain = best_dir

    score = 1.0 - abs(_dot(grain, ax))
    return GrainDirectionInfo(
        recommended_direction=list(grain),
        bend_axes=[list(a) for a in axes],
        alignment_score=round(score, 3),
        notes=f"Single bend axis detected. Grain perpendicular to bend gives score {score:.2f}.",
    )


def _multi_bend_candidates(
    axes: List[Tuple[float, float, float]],
) -> List[Tuple[float, float, float]]:
    """Generate candidate grain directions from fixed set + cross products."""
    candidates: List[Tuple[float, float, float]] = [
        (1.0, 0.0, 0.0),
        (0.0, 1.0, 0.0),
        (0.0, 0.0, 1.0),
        _normalize((1, 1, 0)),
        _normalize((1, -1, 0)),
        _normalize((1, 0, 1)),
        _normalize((0, 1, 1)),
    ]
    for i in range(min(len(axes), 3)):
        for j in range(i + 1, min(len(axes), 3)):
            cp = _normalize(_cross(axes[i], axes[j]))
            if sum(c * c for c in cp) > 0.5:
                candidates.append(cp)
    return candidates


def _multi_bend_direction(
    axes: List[Tuple[float, float, float]],
    raw_axes: List[Tuple[float, float, float]],
) -> GrainDirectionInfo:
    """Find grain direction that maximises perpendicularity to all bend axes."""
    candidates = _multi_bend_candidates(axes)

    best_dir = candidates[0]
    best_score = -1.0
    for c in candidates:
        perps = [1.0 - abs(_dot(c, ax)) for ax in axes]
        score = sum(perps) / len(perps)
        if score > best_score:
            best_score = score
            best_dir = c

    notes_parts = [f"{len(axes)} bend axes detected."]
    if best_score > 0.85:
        notes_parts.append("Excellent grain alignment possible (all bends perpendicular).")
    elif best_score > 0.6:
        notes_parts.append("Good grain alignment. Some bends have moderate angle to grain.")
    else:
        notes_parts.append(
            "Conflicting bend directions. Consider re-orienting part or splitting bends."
        )

    return GrainDirectionInfo(
        recommended_direction=list(best_dir),
        bend_axes=[list(a) for a in raw_axes],
        alignment_score=round(best_score, 3),
        notes=" ".join(notes_parts),
    )


def analyze_grain_direction(
    bend_axes: Optional[List[Tuple[float, float, float]]] = None,
    flat_length: float = 0.0,
    flat_width: float = 0.0,
) -> GrainDirectionInfo:
    """Recommend grain direction from bend axes and flat dimensions."""
    if not bend_axes:
        return _no_bend_direction(flat_length, flat_width)

    # Normalize axes and filter degenerate ones
    axes = [_normalize(a) for a in bend_axes]
    axes = [a for a in axes if sum(c * c for c in a) > 0.5]

    if len(axes) == 0:
        return GrainDirectionInfo(
            recommended_direction=[1.0, 0.0, 0.0],
            bend_axes=[list(a) for a in bend_axes],
            alignment_score=0.5,
            notes="Could not determine valid bend axes.",
        )

    if len(axes) == 1:
        return _single_bend_direction(axes)

    return _multi_bend_direction(axes, bend_axes)
