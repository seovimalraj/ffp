"""Shared fixtures for the sheet-metal analysis tests.

Mirrors ``tests/machining/conftest.py`` exactly, pointed at the new
``app.sheet_metal`` package.
"""

from __future__ import annotations

import os
from pathlib import Path

import pytest

from app.machining import occ
from app.machining.parser import CADParser
from app.sheet_metal.config import SheetMetalConfig, get_sheet_metal_config, reset_config_cache
from app.sheet_metal.schemas import SheetMetalAnalysisOptions
from app.sheet_metal.service import SheetMetalAnalysisService, analyze_sheet_metal

requires_kernel = pytest.mark.skipif(
    not occ.kernel_available(),
    reason="No OpenCASCADE binding installed (pip install cadquery-ocp, or conda pythonocc-core)",
)


@pytest.fixture(scope="session")
def config() -> SheetMetalConfig:
    reset_config_cache()
    return get_sheet_metal_config()


@pytest.fixture
def parser(config) -> CADParser:
    return CADParser(config)  # type: ignore[arg-type]


@pytest.fixture(scope="session")
def step_dir(tmp_path_factory) -> Path:
    """One directory of generated STEP fixtures, reused across the session."""
    return tmp_path_factory.mktemp("sheet-metal-step-fixtures")


@pytest.fixture
def analyze(parser):
    """Analyse a fixture builder and return the JSON-ready payload."""

    def _run(step_path: str, **option_overrides):
        options = SheetMetalAnalysisOptions(**option_overrides)
        loaded = parser.load(
            step_path,
            os.path.basename(step_path),
            os.path.getsize(step_path),
            "0" * 64,
        )
        return analyze_sheet_metal(loaded, options, parser.config)

    return _run


@pytest.fixture
def service(config) -> SheetMetalAnalysisService:
    return SheetMetalAnalysisService(config)
