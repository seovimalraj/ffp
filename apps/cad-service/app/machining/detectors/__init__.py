"""Feature detectors.

Each detector is an independent class that consumes a
:class:`~app.machining.records.ShapeModel` and returns typed features. None of
them touch HTTP, and none of them make cost or process decisions.
"""

from .holes import HoleDetector
from .pockets import PocketDetector
from .slots import SlotDetector
from .bosses import BossDetector
from .grooves import GrooveDetector
from .blends import ChamferDetector, FilletDetector
from .threads import ThreadDetector

__all__ = [
    "HoleDetector",
    "PocketDetector",
    "SlotDetector",
    "BossDetector",
    "GrooveDetector",
    "FilletDetector",
    "ChamferDetector",
    "ThreadDetector",
]
