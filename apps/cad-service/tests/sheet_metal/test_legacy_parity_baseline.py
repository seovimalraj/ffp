"""Parity/sanity baseline against the legacy detection code.

This is NOT a byte-for-byte port of ``tests/test_bend_detection.py`` or
``test_advanced_thickness_detection.py``. Those legacy tests exercise
``app.core.bend_detection.AdvancedBendDetector`` and
``app.core.advanced_thickness_detection.AdvancedThicknessDetector`` directly
against hand-picked bbox/volume/surface-area numbers and synthetic mesh
distance lists - a purely heuristic, ray-casting-mesh pipeline with no B-rep
awareness. The new ``app.sheet_metal`` pipeline is a completely different
approach: it works from a real B-rep ``ShapeModel`` (faces/edges/adjacency)
produced by ``app.machining.parser``, and per the design's "port, don't
couple" decision it does not import or call into ``app.core`` at all.

Given that, there is no meaningful way to feed the same inputs to both and
compare outputs field-for-field. Instead, this module re-derives the same
*known-good expectations* the legacy tests encode - e.g. "a U/L-bracket with
a ~90 degree bend and ~2mm walls should be recognised as sheet metal with a
plausible thickness and bend angle" - and checks that the new pipeline
reaches an equivalent, reasonable conclusion on equivalent geometry (built
from the new pipeline's own STEP fixtures, since the two pipelines cannot
share a fixture format). This is a sanity/regression baseline: it guards
against the new pipeline silently regressing to implausible numbers, not a
guarantee of numerical agreement with the legacy heuristics.
"""

from __future__ import annotations

from app.sheet_metal.config import SheetMetalConfig

from . import fixtures
from .conftest import requires_kernel

CONFIG = SheetMetalConfig()


@requires_kernel
def test_l_bracket_parity_with_legacy_bend_detection_expectations(analyze, step_dir):
    """Legacy baseline: ``test_bend_detection.py::test_l_bracket_detection``
    modelled an L-bracket (two perpendicular ~3mm-wall arms, one ~90 degree
    bend) and asserted ``is_likely_bent is True`` with ``bend_count >= 1``.

    Equivalent new-pipeline geometry: ``fixtures.swept_l_bracket_bend`` builds
    an L-bracket with a real cylindrical bend face, modelled at 2mm wall
    thickness and a ~90 degree bend with a 3mm inner radius (see
    ``test_bends_units.py`` for the fixture's own integration coverage of the
    exact numeric tolerances). Here we only assert the coarse, legacy-style
    conclusions: at least one bend is found, and its angle is in the
    plausible ~90 degree range a press-brake bend would produce.
    """
    step_path = fixtures.swept_l_bracket_bend(step_dir)
    payload = analyze(step_path)

    candidate = payload["sheet_metal_candidate"]
    assert candidate["is_candidate"] is True, "L-bracket should read as a sheet-metal candidate"

    bends = payload["bends"]
    assert len(bends) >= 1, "L-bracket should be detected as bent (legacy: is_likely_bent)"
    bend = bends[0]
    # Legacy tests treated "close to 90 degrees" as the plausibility bar for
    # a single press-brake bend; keep the same coarse tolerance here.
    assert 60.0 <= bend["angle_deg"] <= 120.0

    thickness = payload["thickness"]
    assert thickness["dominant_thickness_mm"] is not None
    # Fixture is modelled at 2mm walls (legacy L-bracket test used ~3mm).
    assert 1.0 <= thickness["dominant_thickness_mm"] <= 3.0


@requires_kernel
def test_flat_plate_parity_with_legacy_flat_sheet_expectations(analyze, step_dir):
    """Legacy baseline: ``test_bend_detection.py::test_flat_sheet_no_bends``
    modelled a flat 3mm sheet and asserted ``is_likely_bent is False`` and
    ``bend_count == 0``.

    Equivalent new-pipeline geometry: ``fixtures.flat_plate_with_holes`` is a
    flat plate (modelled at 1.5mm) with no bend faces at all.
    """
    step_path = fixtures.flat_plate_with_holes(step_dir)
    payload = analyze(step_path)

    candidate = payload["sheet_metal_candidate"]
    assert candidate["is_candidate"] is True

    assert payload["bends"] == [], "Flat plate should report zero bends (legacy: bend_count == 0)"

    thickness = payload["thickness"]
    assert thickness["dominant_thickness_mm"] is not None
    assert 1.0 <= thickness["dominant_thickness_mm"] <= 2.5


@requires_kernel
def test_solid_block_parity_with_legacy_cnc_block_expectations(analyze, step_dir):
    """Legacy baseline: ``test_bend_detection.py::test_cnc_block_not_bent``
    modelled a solid 50x50x50mm CNC block and asserted
    ``is_likely_bent is False`` with low confidence, i.e. it should not be
    mistaken for sheet metal at all.

    Equivalent new-pipeline geometry: ``fixtures.solid_block_non_candidate``
    is a solid block with no thin-walled candidate pair, so it should be
    rejected before bend detection ever runs.
    """
    step_path = fixtures.solid_block_non_candidate(step_dir)
    payload = analyze(step_path)

    candidate = payload["sheet_metal_candidate"]
    assert candidate["is_candidate"] is False
    assert candidate["status"] == "rejected"
    # A rejected candidate still degrades gracefully - no bends are reported.
    assert payload["bends"] == []


@requires_kernel
def test_thickness_detection_parity_with_legacy_uniform_thickness_expectations(
    analyze, step_dir
):
    """Legacy baseline: ``test_advanced_thickness_detection.py`` asserted
    that a uniform-thickness sheet (synthetic 2mm mesh distances) is detected
    as sheet thickness with high confidence, while a solid block's varying
    distances are rejected.

    The new pipeline's ``detect_thickness`` works from opposed planar face
    pairs on a real B-rep rather than a synthetic mesh-distance histogram, so
    this only checks the same coarse conclusion: a uniformly thin part
    reports a single plausible dominant thickness, and a solid block reports
    none.
    """
    thin_path = fixtures.flat_plate_with_holes(step_dir)
    thin_payload = analyze(thin_path)
    thin_thickness = thin_payload["thickness"]
    assert thin_thickness["dominant_thickness_mm"] is not None
    assert thin_thickness["is_uniform"] is not False

    block_path = fixtures.solid_block_non_candidate(step_dir)
    block_payload = analyze(block_path)
    # A rejected candidate degrades gracefully to schema defaults rather than
    # reporting a spurious thickness (legacy: solid block has no uniform
    # thickness at all).
    assert block_payload["thickness"]["dominant_thickness_mm"] is None
