"""Unit normalisation for the response payload.

Analysis always runs in millimetres - the STEP reader is pinned to MM at import
time - so the canonical result is metric and fully deterministic. When a client
asks for ``unit_system=imperial`` the finished payload is converted in one pass
here rather than by threading a scale factor through every detector, which
keeps the geometry code single-unit and reproducible.

Direction vectors (``axis``, ``normal``, ``orientation``,
``machining_direction``) are unit vectors and are never scaled.
"""

from __future__ import annotations

from typing import Any, Dict, List, Set

MM_PER_INCH = 25.4

#: Keys whose value is a point in space, so every component is a length.
_POSITION_KEYS: Set[str] = {
    "position",
    "center_of_mass",
    "axis_location",
    "min",
    "max",
}

#: Keys whose value is a direction - dimensionless, never converted.
_DIRECTION_KEYS: Set[str] = {
    "axis",
    "normal",
    "orientation",
    "machining_direction",
    "principal_axis",
}

#: Bare length keys that appear inside an already-suffixed parent.
_BARE_LENGTH_KEYS: Set[str] = {"length", "width", "height"}

_INERTIA_KEYS: Set[str] = {"ixx", "iyy", "izz", "ixy", "ixz", "iyz"}


def _factor_for(key: str) -> float:
    """Divisor converting a millimetre value to inches for the given key."""
    if key.endswith("_mm3"):
        return MM_PER_INCH**3
    if key.endswith("_mm2"):
        return MM_PER_INCH**2
    if key.endswith("_mm"):
        return MM_PER_INCH
    return 1.0


def _scale_number(value: Any, factor: float) -> Any:
    if isinstance(value, bool) or value is None:
        return value
    if isinstance(value, (int, float)):
        return value / factor
    if isinstance(value, list):
        return [_scale_number(v, factor) for v in value]
    return value


def to_imperial(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Return a copy of ``payload`` with every length converted to inches.

    Field *names* keep their ``_mm`` suffix so the JSON schema stays stable
    across unit systems; the authoritative unit is the top-level ``units``
    field, which this function does not set (the caller does).
    """
    return _convert(payload, in_position=False, in_inertia=False)


def _convert(node: Any, *, in_position: bool, in_inertia: bool) -> Any:
    if isinstance(node, dict):
        result: Dict[str, Any] = {}
        for key, value in node.items():
            result[key] = _convert_pair(key, value, in_position, in_inertia)
        return result
    if isinstance(node, list):
        return [_convert(item, in_position=in_position, in_inertia=in_inertia) for item in node]
    if in_position and isinstance(node, (int, float)) and not isinstance(node, bool):
        return node / MM_PER_INCH
    return node


def _convert_pair(key: str, value: Any, in_position: bool, in_inertia: bool) -> Any:
    if key in _DIRECTION_KEYS:
        return value  # unit vector - dimensionless

    # Inside a point (``position``, ``min``, ``max``, ...) every component is a
    # length, whatever the component is called.
    if in_position and isinstance(value, (int, float)) and not isinstance(value, bool):
        return value / MM_PER_INCH

    if key == "moments_of_inertia":
        return _convert(value, in_position=False, in_inertia=True)

    if in_inertia and key in _INERTIA_KEYS:
        # Second moments of a unit-density solid carry mm^5.
        return _scale_number(value, MM_PER_INCH**5)

    if in_inertia and key == "principal":
        return _scale_number(value, MM_PER_INCH**5)

    if key in _POSITION_KEYS:
        if isinstance(value, dict):
            return _convert(value, in_position=True, in_inertia=False)
        return _scale_number(value, MM_PER_INCH)

    factor = _factor_for(key)
    if factor != 1.0:
        if isinstance(value, dict):
            # e.g. stock_dimensions_mm: {length, width, height}
            return {
                inner_key: (
                    _scale_number(inner_value, factor)
                    if inner_key in _BARE_LENGTH_KEYS
                    else _convert(inner_value, in_position=False, in_inertia=False)
                )
                for inner_key, inner_value in value.items()
            }
        return _scale_number(value, factor)

    if isinstance(value, (dict, list)):
        return _convert(value, in_position=in_position, in_inertia=in_inertia)

    return value
