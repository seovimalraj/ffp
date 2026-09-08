"""Sheet-metal detector modules.

Each module here is a self-contained, kernel-independent detector that reasons
over :class:`~app.machining.records.ShapeModel` (the flattened B-Rep already
produced by ``app.sheet_metal.service`` via the reused
``app.machining.topology.TopologyAnalyzer``). Detectors never touch OCCT
directly - only ``app.machining.occ`` does that, at parse time - which keeps
every function here unit-testable with synthetic ``FaceRecord``/``ShapeModel``
objects and no CAD kernel installed.
"""
