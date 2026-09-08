"""Sheet-metal geometric feature-recognition package.

Structurally parallel to ``app.machining`` (see
``docs/superpowers/specs/2026-09-07-sheet-metal-analysis-design.md``), but
detecting sheet-metal-specific features (thickness, bends, flanges, hems,
holes/cutouts, DFM distance checks) instead of milling/turning features.

Flat-pattern unfolding is out of scope for this iteration.

This package reuses ``app.machining.occ`` (the OCC/OCP binding shim) and
``app.machining.parser`` (upload -> temp file -> sha256 -> shape load)
directly rather than forking copies of either.
"""
