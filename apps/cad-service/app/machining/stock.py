"""Bounding-box stock estimation.

This is an *estimate* and is labelled as one. It is not a purchased stock size:
real stock comes in discrete sizes, may be a casting or an extrusion, and is a
purchasing decision this endpoint has no business making. No material, grade,
or cost is implied.
"""

from __future__ import annotations

import logging
import math
from typing import Optional

from .config import MachiningConfig
from .records import MassProperties, ShapeModel
from .schemas import StockAnalysis, StockDimensions
from .stock_form import StockFormClassifier

logger = logging.getLogger(__name__)


class StockAnalyzer:
    """Bounding box plus a configurable per-side machining allowance."""

    def __init__(self, config: MachiningConfig):
        self.config = config
        self.form_classifier = StockFormClassifier(config)

    def analyze(
        self, model: ShapeModel, mass: MassProperties
    ) -> Optional[StockAnalysis]:
        size = model.bbox_size
        if min(size) <= 0:
            logger.warning("Degenerate bounding box %s - stock estimate skipped", size)
            return None

        allowance = self.config.stock_allowance_mm
        dimensions = [self._round_up(value + 2.0 * allowance) for value in size]
        stock_volume = dimensions[0] * dimensions[1] * dimensions[2]
        finished = max(0.0, mass.volume_mm3)
        removed = max(0.0, stock_volume - finished)
        ratio = removed / stock_volume if stock_volume > 0 else 0.0

        return StockAnalysis(
            allowance_per_side_mm=allowance,
            stock_dimensions_mm=StockDimensions(
                length=self._r(dimensions[0]),
                width=self._r(dimensions[1]),
                height=self._r(dimensions[2]),
            ),
            stock_volume_mm3=round(stock_volume, self.config.volume_decimals),
            finished_volume_mm3=round(finished, self.config.volume_decimals),
            removed_volume_mm3=round(removed, self.config.volume_decimals),
            material_removal_ratio=round(ratio, 4),
            stock_form=self.form_classifier.classify(model),
        )

    def _round_up(self, value: float) -> float:
        """Round a stock dimension up to the configured increment."""
        step = self.config.stock_round_up_to_mm
        if step and step > 0:
            return math.ceil(value / step) * step
        return value

    def _r(self, value: float) -> float:
        return round(value, self.config.length_decimals)
