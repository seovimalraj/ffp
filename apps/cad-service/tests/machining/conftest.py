"""Shared fixtures for the machining analysis tests."""

from __future__ import annotations

import os
from pathlib import Path

import pytest

from app.machining import occ
from app.machining.config import MachiningConfig, get_machining_config, reset_config_cache
from app.machining.parser import CADParser
from app.machining.schemas import MachiningAnalysisOptions
from app.machining.service import MachiningAnalysisService, analyze_machining

requires_kernel = pytest.mark.skipif(
    not occ.kernel_available(),
    reason="No OpenCASCADE binding installed (pip install cadquery-ocp, or conda pythonocc-core)",
)


@pytest.fixture(scope="session")
def config() -> MachiningConfig:
    reset_config_cache()
    return get_machining_config()


@pytest.fixture
def parser(config) -> CADParser:
    return CADParser(config)


@pytest.fixture(scope="session")
def step_dir(tmp_path_factory) -> Path:
    """One directory of generated STEP fixtures, reused across the session."""
    return tmp_path_factory.mktemp("step-fixtures")


@pytest.fixture
def analyze(parser):
    """Analyse a fixture builder and return the JSON-ready payload."""

    def _run(step_path: str, **option_overrides):
        options = MachiningAnalysisOptions(**option_overrides)
        loaded = parser.load(
            step_path,
            os.path.basename(step_path),
            os.path.getsize(step_path),
            "0" * 64,
        )
        return analyze_machining(loaded, options, parser.config)

    return _run


@pytest.fixture
def service(config) -> MachiningAnalysisService:
    return MachiningAnalysisService(config)
