"""Deterministic CNC-machining geometry analysis.

This package answers exactly one question: **what geometry exists?**

It never estimates cost, selects a machine, or produces a price. It emits a
normalized JSON document describing the B-Rep geometry and the machining
relevant features found in it, so that a downstream costing engine can consume
the result without knowing anything about OpenCASCADE.

No LLM is involved anywhere in this package: the same CAD file always yields
the same JSON.
"""

from .service import MachiningAnalysisService, analyze_machining
from .config import MachiningConfig, get_machining_config

__all__ = [
    "MachiningAnalysisService",
    "analyze_machining",
    "MachiningConfig",
    "get_machining_config",
]

ANALYSIS_VERSION = "1.0"
