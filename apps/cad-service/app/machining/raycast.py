"""Ray casting against the solid.

Used for two questions that are really the same question:

* is this feature reachable by a tool coming from direction *d*?
  (:mod:`.accessibility`)
* is this planar face actually the floor of a recess, rather than one of its
  walls? (:mod:`.detectors.pockets`)

Both reduce to: *fire a ray from outside the model towards a point and see
whether anything is hit first.*
"""

from __future__ import annotations

import logging
from typing import Any, Optional

from . import occ
from .config import MachiningConfig
from .records import ShapeModel
from .vectors import Vec, add, normalize, scale

logger = logging.getLogger(__name__)


class RayProbe:
    """Answers "can a straight line reach this point from this direction?"."""

    def __init__(self, model: ShapeModel, config: MachiningConfig):
        self.model = model
        self.config = config
        self.standoff = model.bbox_diagonal + config.accessibility_ray_clearance_mm
        self._intersector = self._make_intersector()

    @property
    def available(self) -> bool:
        """False when the kernel build has no curve/surface intersector."""
        return self._intersector is not None and self.standoff > 0

    def _make_intersector(self) -> Optional[Any]:
        if occ.BRepIntCurveSurface_Inter is None or self.model._occ_shape is None:
            return None
        try:
            return occ.BRepIntCurveSurface_Inter()
        except Exception as exc:  # pragma: no cover - binding dependent
            logger.warning("Ray intersector unavailable: %s", exc)
            return None

    def nearest_hit(self, target: Vec, direction: Vec) -> Optional[float]:
        """Distance to the first face met travelling towards ``target``.

        The ray starts ``standoff`` away along ``+direction`` and travels back
        along ``-direction``, so the returned distance is directly comparable
        with ``standoff``: a value equal to it means the ray reached the target
        untouched, a smaller value means something got in the way.

        Returns ``None`` when nothing at all is hit.
        """
        if not self.available:
            return None

        direction = normalize(direction)
        start = add(target, scale(direction, self.standoff))
        travel = scale(direction, -1.0)

        try:
            line = occ.gp_Lin(
                occ.gp_Pnt(*start), occ.gp_Dir(travel[0], travel[1], travel[2])
            )
            self._intersector.Init(
                self.model._occ_shape, line, self.config.linear_tolerance_mm
            )
            nearest: Optional[float] = None
            while self._intersector.More():
                w = float(self._intersector.W())
                if w > 0 and (nearest is None or w < nearest):
                    nearest = w
                self._intersector.Next()
            return nearest
        except Exception as exc:
            logger.debug("Ray cast towards %s along %s failed: %s", target, direction, exc)
            return None

    def is_clear(self, target: Vec, direction: Vec) -> bool:
        """True when nothing obstructs the approach to ``target``.

        ``None`` (no hit at all) counts as clear: probing a through hole along
        its own axis runs the ray down the void and legitimately meets nothing.
        """
        if not self.available:
            return False
        nearest = self.nearest_hit(target, direction)
        if nearest is None:
            return True
        return nearest >= self.standoff - self.config.accessibility_hit_tolerance_mm

    def is_face_exposed(self, target: Vec, outward_normal: Vec) -> bool:
        """True when a face is the *first* thing seen from its own normal side.

        This is what separates a pocket floor from a pocket wall. Looking down a
        floor's normal you see the floor; looking along a wall's normal you see
        the opposite side of the part, because the wall is edge-on to that view.

        Unlike :meth:`is_clear`, a miss is *not* treated as exposure - a face
        must actually be seen.
        """
        if not self.available:
            return False
        nearest = self.nearest_hit(target, outward_normal)
        if nearest is None:
            return False
        return abs(nearest - self.standoff) <= self.config.accessibility_hit_tolerance_mm
