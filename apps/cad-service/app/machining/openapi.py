"""OpenAPI examples for the machining endpoint.

Kept out of the router so the controller stays readable, and abridged rather
than pulled from ``examples/example_response.json`` - the full document runs to
~18 kB, which would make ``/openapi.json`` unpleasant to load and the Swagger
page unreadable. The complete response is in the examples directory.

The values below are taken from a real analysis of the demo bracket
(120 x 80 x 35 with a 4-hole rectangular pattern, a counterbored centre hole, a
pocket and a slot), so they are representative rather than invented.
"""

from __future__ import annotations

from typing import Any, Dict

SUCCESS_EXAMPLE: Dict[str, Any] = {
    "success": True,
    "analysis_version": "1.0",
    "kernel": "OCP",
    "units": "mm",
    "analysis_duration_ms": 412.7,
    "options": {
        "unit_system": "metric",
        "include_face_details": False,
        "include_feature_details": True,
        "include_debug_geometry": False,
    },
    "file": {
        "filename": "demo_bracket.step",
        "format": "STEP",
        "file_size_bytes": 95534,
        "sha256": "9f2c1e..." ,
    },
    "model": {
        "solid_count": 1,
        "shell_count": 1,
        "face_count": 28,
        "edge_count": 77,
        "vertex_count": 51,
        "wire_count": 38,
        "compound_count": 0,
        "is_valid": True,
        "has_open_shells": False,
        "is_multi_body": False,
    },
    "geometry": {
        "bounding_box": {
            "min": {"x": 0.0, "y": 0.0, "z": 0.0},
            "max": {"x": 120.0, "y": 80.0, "z": 35.0},
            "length_mm": 120.0,
            "width_mm": 80.0,
            "height_mm": 35.0,
            "diagonal_mm": 148.408,
        },
        "volume_mm3": 321652.57,
        "surface_area_mm2": 34168.02,
        "center_of_mass": {"x": 59.884, "y": 40.0, "z": 17.223},
        "is_closed_volume": True,
        "source": "GEOMETRY",
    },
    "topology": {
        "faces_per_solid": [28],
        "closed_shell_count": 1,
        "open_shell_count": 0,
        "free_edge_count": 0,
        "seam_edge_count": 7,
        "max_faces_per_edge": 2,
        "euler_characteristic": 2,
    },
    "surface_summary": {
        "planar_faces": 21,
        "cylindrical_faces": 7,
        "conical_faces": 0,
        "spherical_faces": 0,
        "toroidal_faces": 0,
        "freeform_faces": 0,
        "other_faces": 0,
        "total_faces": 28,
        "internal_cylindrical_faces": 7,
        "external_cylindrical_faces": 0,
    },
    "features": {
        "holes": [
            {
                "id": "HOLE-001",
                "type": "hole",
                "subtype": "counterbore",
                "diameter_mm": 8.0,
                "radius_mm": 4.0,
                "depth_mm": 35.0,
                "through": True,
                "position": {"x": 60.0, "y": 40.0, "z": 35.0},
                "axis": {"x": 0.0, "y": 0.0, "z": 1.0},
                "quantity": 1,
                "depth_diameter_ratio": 4.375,
                "is_stepped": True,
                "has_counterbore": True,
                "has_countersink": False,
                "counterbore_diameter_mm": 14.0,
                "counterbore_depth_mm": 6.0,
                "face_ids": [12, 13, 14],
                "status": "resolved",
                "detection": {
                    "method": "coaxial_grouping",
                    "confidence": 0.85,
                    "evidence": [
                        "2 coaxial concave cylindrical face(s)",
                        "angular span 360.0 deg",
                        "no closing face found on either end - through",
                    ],
                    "source": "GEOMETRY",
                },
            },
        ],
        "bores": [],
        "internal_cylindrical_features": [],
        "pockets": [
            {
                "id": "POCKET-001",
                "type": "pocket",
                "length_mm": 30.0,
                "width_mm": 30.0,
                "depth_mm": 8.0,
                "area_mm2": 876.0,
                "bottom_type": "planar",
                "closed": True,
                "corner_radius_mm": 4.0,
                "minimum_internal_radius_mm": 4.0,
                "machining_direction": [0.0, 0.0, 1.0],
                "position": {"x": 45.0, "y": 40.0, "z": 27.0},
                "depth_width_ratio": 0.267,
                "wall_count": 4,
                "status": "resolved",
                "detection": {
                    "method": "topology_and_surface_analysis",
                    "confidence": 0.9,
                    "evidence": [
                        "planar floor face 19 recessed below the silhouette",
                        "4 enclosing wall face(s)",
                        "depth 8.0 mm along the floor normal",
                        "floor boundary fully enclosed by walls",
                    ],
                    "source": "GEOMETRY",
                },
            }
        ],
        "slots": [
            {
                "id": "SLOT-001",
                "type": "slot",
                "subtype": "blind_slot",
                "length_mm": 36.4,
                "width_mm": 6.0,
                "depth_mm": 5.0,
                "through": False,
                "corner_radius_mm": 7.0,
                "orientation": {"x": 1.0, "y": 0.0, "z": 0.0},
                "machining_direction": [0.0, 0.0, 1.0],
                "position": {"x": 81.8, "y": 43.0, "z": 30.0},
                "depth_width_ratio": 0.833,
                "status": "resolved",
                "detection": {
                    "method": "topology_and_surface_analysis",
                    "confidence": 0.9,
                    "evidence": ["length/width aspect ratio 6.07 >= 3.0"],
                    "source": "GEOMETRY",
                },
            }
        ],
        "bosses": [],
        "threads": [],
        "fillets": [],
        "chamfers": [],
        "fillet_summary": {
            "count": 0,
            "unique_radii_mm": [],
            "minimum_radius_mm": None,
            "minimum_internal_radius_mm": None,
        },
        "chamfer_summary": {"count": 0, "sizes_mm": [], "unique_angles_deg": []},
    },
    "feature_patterns": [
        {
            "type": "repeated_hole",
            "feature_type": "hole",
            "feature_count": 4,
            "feature_ids": ["HOLE-002", "HOLE-003", "HOLE-004", "HOLE-005"],
            "pattern_type": "rectangular",
            "diameter_mm": 6.0,
            "depth_mm": 35.0,
            "axis": {"x": 0.0, "y": 0.0, "z": 1.0},
            "detection": {
                "method": "topology_and_surface_analysis",
                "confidence": 0.95,
                "evidence": [
                    "4 features identical on diameter and depth",
                    "positions form a rectangular arrangement",
                ],
                "source": "GEOMETRY",
            },
        }
    ],
    "feature_dimensions": [
        {
            "feature_id": "HOLE-002",
            "feature_type": "hole",
            "diameter_mm": 6.0,
            "depth_mm": 35.0,
            "depth_diameter_ratio": 5.833,
        },
    ],
    "machining_flags": [
        {
            "feature_id": "HOLE-002",
            "flag": "DEEP_HOLE",
            "reason": "depth_diameter_ratio = 5.833 >= 5.0",
            "threshold": 5.0,
            "value": 5.8333,
        },
    ],
    "machining_constraints": [
        {
            "feature_id": "POCKET-001",
            "feature_type": "pocket",
            "tooling_constraints": {
                "minimum_internal_radius_mm": 4.0,
                "maximum_tool_diameter_mm": 8.0,
                "note": (
                    "Geometric limit only. No cutting parameters, tool selection, "
                    "or feeds and speeds are implied."
                ),
            },
        }
    ],
    "accessibility": [
        {
            "feature_id": "HOLE-001",
            "feature_type": "hole",
            "accessibility": {
                "+X": False,
                "-X": False,
                "+Y": False,
                "-Y": False,
                "+Z": True,
                "-Z": True,
            },
            "accessible_direction_count": 2,
            "primary_direction": "+Z",
            "requires_rotation": False,
            "requires_advanced_axis_analysis": False,
            "detection": {
                "method": "ray_casting",
                "confidence": 0.9,
                "evidence": [
                    "2 of 6 principal directions clear",
                    "obstruction tested by ray casting against the solid",
                ],
                "source": "GEOMETRY",
            },
        },
    ],
    "setup_analysis": {
        "candidate_directions": [
            {
                "direction": "+Z",
                "accessible_feature_count": 8,
                "feature_ids": ["HOLE-001", "POCKET-001", "SLOT-001"],
            },
            {"direction": "-Z", "accessible_feature_count": 5, "feature_ids": []},
            {"direction": "+X", "accessible_feature_count": 0, "feature_ids": []},
        ],
        "minimum_direction_count_covering_all": 1,
        "unreachable_feature_ids": [],
        "requires_rotation": False,
        "note": "Geometric evidence for a downstream planner. This is not a setup plan.",
    },
    "stock_analysis": {
        "method": "bounding_box_plus_allowance",
        "estimated": True,
        "allowance_per_side_mm": 2.5,
        "stock_dimensions_mm": {"length": 125.0, "width": 85.0, "height": 40.0},
        "stock_volume_mm3": 425000.0,
        "finished_volume_mm3": 321652.57,
        "removed_volume_mm3": 103347.43,
        "material_removal_ratio": 0.2432,
        "stock_form": {
            "method": "extent_ratios_and_surface_evidence",
            "form": "BLOCK",
            "status": "resolved",
            "reason": None,
            "candidate_forms": [],
            "bounds_method": "obb",
            "sorted_dimensions_mm": {"length": 120.0, "width": 80.0, "height": 35.0},
            "thickness_mm": 35.0,
            "flatness_ratio": 0.4375,
            "slenderness_ratio": 0.6667,
            "cross_section_ratio": 0.5625,
            "round_evidence": None,
            "sheet_evidence": None,
            "note": (
                "Geometric form of the envelope. No material, grade, availability "
                "or cost is implied, and this is not a purchasing recommendation."
            ),
        },
        "note": (
            "Bounding-box estimate. Not a commercially purchased stock size, and "
            "no material, grade, or cost is implied."
        ),
    },
    "complexity_indicators": {
        "hole_count": 5,
        "deep_hole_count": 4,
        "pocket_count": 2,
        "slot_count": 1,
        "bore_count": 0,
        "thread_count": 0,
        "fillet_count": 0,
        "chamfer_count": 0,
        "boss_count": 0,
        "freeform_surface_count": 0,
        "thin_wall_count": 0,
        "unique_tool_diameter_constraints": 2,
        "accessible_directions": 2,
        "distinct_hole_diameter_count": 2,
        "minimum_internal_radius_mm": 4.0,
        "maximum_depth_diameter_ratio": 5.8333,
        "feature_count_total": 8,
    },
    "pmi": {
        "available": True,
        "part_name": "BRACKET-4471",
        "part_number": "4471",
        "revision": "C",
        "material": None,
        "surface_finish": None,
        "gdt": [],
        "datums": [],
        "annotations": [],
        "feature_names": [],
        "source": "CAD_METADATA",
        "note": (
            "Everything here is declared by the CAD file, not measured from the "
            "geometry."
        ),
    },
    "warnings": [],
    "errors": [],
    "debug_geometry": None,
}


AMBIGUOUS_EXAMPLE: Dict[str, Any] = {
    "summary": "Ambiguous feature and a multi-body warning",
    "description": (
        "Geometry that cannot be resolved is reported honestly rather than "
        "guessed. Note `status: ambiguous` with a `reason`, the "
        "`internal_cylindrical_feature` bucket for a cylinder that is neither "
        "clearly a hole nor clearly a bore, and the `MULTIPLE_SOLIDS` warning - "
        "extra bodies are never silently ignored."
    ),
    "value": {
        "success": True,
        "analysis_version": "1.0",
        "units": "mm",
        "model": {"solid_count": 2, "face_count": 34, "is_multi_body": True},
        "features": {
            "holes": [],
            "bores": [],
            "internal_cylindrical_features": [
                {
                    "id": "ICF-001",
                    "type": "internal_cylindrical_feature",
                    "diameter_mm": 30.0,
                    "depth_mm": 6.0,
                    "blind": True,
                    "position": {"x": 40.0, "y": 40.0, "z": 20.0},
                    "axis": {"x": 0.0, "y": 0.0, "z": 1.0},
                    "status": "ambiguous",
                    "reason": (
                        "Internal cylindrical surface is above the hole diameter "
                        "limit (25.0 mm) but below the bore depth threshold "
                        "(10.0 mm); geometry alone cannot separate a bore from a "
                        "shallow recess."
                    ),
                    "detection": {
                        "method": "coaxial_grouping",
                        "confidence": 0.95,
                        "evidence": ["1 coaxial concave cylindrical face(s)"],
                        "source": "GEOMETRY",
                    },
                }
            ],
            "threads": [
                {
                    "id": "THREAD-001",
                    "type": "thread",
                    "thread_type": "internal_thread",
                    "designation": None,
                    "nominal_diameter_mm": 8.0,
                    "pitch_mm": None,
                    "confidence": "unknown",
                    "status": "ambiguous",
                    "reason": (
                        "Helical geometry detected but no thread designation is "
                        "present in the CAD file. The designation is not inferred "
                        "from diameter."
                    ),
                    "detection": {
                        "method": "helical_geometry",
                        "confidence": 0.8,
                        "evidence": ["2.9 turns, pitch not measurable"],
                        "source": "GEOMETRY",
                    },
                }
            ],
        },
        "warnings": [
            {
                "code": "MULTIPLE_SOLIDS",
                "message": (
                    "The model contains 2 separate solid bodies. All bodies were "
                    "analysed together; feature counts and stock estimates span "
                    "the whole assembly."
                ),
                "detail": {"solid_count": 2},
            },
            {
                "code": "AMBIGUOUS_FEATURE",
                "message": (
                    "2 feature(s) could not be resolved unambiguously from "
                    "geometry; each carries a 'reason'."
                ),
                "detail": {"feature_ids": ["ICF-001", "THREAD-001"]},
            },
        ],
        "errors": [],
    },
}


def _error(code: str, message: str, detail: Any = None) -> Dict[str, Any]:
    return {
        "success": False,
        "analysis_version": "1.0",
        "errors": [{"code": code, "message": message, "detail": detail}],
        "warnings": [],
    }


ERROR_EXAMPLES: Dict[int, Dict[str, Any]] = {
    400: {
        "corrupt": {
            "summary": "Corrupt or unreadable CAD file",
            "value": _error(
                "CORRUPT_CAD_FILE",
                "STEP import failed (OCCT status 1). The file is not a readable "
                "STEP document.",
                {"filename": "bracket.step"},
            ),
        },
        "empty": {
            "summary": "Empty upload",
            "value": _error("EMPTY_FILE", "The uploaded file is empty."),
        },
    },
    413: {
        "too_large": {
            "summary": "Above the upload limit",
            "value": _error(
                "FILE_TOO_LARGE",
                "File exceeds the 104857600 byte limit.",
                {"filename": "huge_assembly.step"},
            ),
        }
    },
    415: {
        "unsupported": {
            "summary": "Unsupported extension",
            "description": (
                "Checked before any bytes are read, so an unsupported upload "
                "costs no bandwidth."
            ),
            "value": _error(
                "UNSUPPORTED_FORMAT",
                "Unsupported file extension '.stl'. Supported: .brep, .brp, "
                ".iges, .igs, .step, .stp.",
                {
                    "filename": "part.stl",
                    "supported": [".brep", ".brp", ".iges", ".igs", ".step", ".stp"],
                },
            ),
        }
    },
    422: {
        "no_solid": {
            "summary": "No closed solid in the model",
            "value": _error(
                "NO_SOLID_GEOMETRY",
                "The model contains 12 shell(s) and 46 face(s) but no closed "
                "solid. Machining analysis requires at least one valid solid. "
                "IGES is a surface format; export a solid STEP file instead.",
                {"filename": "surfaces.igs"},
            ),
        },
        "too_complex": {
            "summary": "Above the face-count limit",
            "value": _error(
                "MODEL_TOO_COMPLEX",
                "The model has 84213 faces, above the 50000 face limit for this "
                "endpoint.",
            ),
        },
    },
    503: {
        "no_kernel": {
            "summary": "CAD kernel not installed",
            "value": _error(
                "CAD_KERNEL_UNAVAILABLE",
                "No OpenCASCADE binding is installed. Install 'OCP' (preferred) "
                "or 'pythonocc-core' from conda-forge.",
            ),
        }
    },
}


def error_responses() -> Dict[int, Dict[str, Any]]:
    """``responses=`` block wiring each status code to its examples."""
    from .schemas import MachiningErrorResponse

    descriptions = {
        400: "Malformed, empty or corrupt CAD file",
        413: "File exceeds the configured size limit",
        415: "Unsupported file format",
        422: "No usable solid geometry, or model too complex",
        503: "CAD kernel unavailable",
    }
    return {
        status: {
            "model": MachiningErrorResponse,
            "description": descriptions[status],
            "content": {"application/json": {"examples": examples}},
        }
        for status, examples in ERROR_EXAMPLES.items()
    }


def success_responses() -> Dict[int, Dict[str, Any]]:
    """``responses=`` block for 200 with both a typical and an edge-case example."""
    return {
        200: {
            "description": "Analysis completed",
            "content": {
                "application/json": {
                    "examples": {
                        "typical": {
                            "summary": "Milled bracket (abridged)",
                            "description": (
                                "A 120 x 80 x 35 bracket with a rectangular hole "
                                "pattern, a counterbored centre hole, a pocket "
                                "and a slot. Feature lists are abridged here; the "
                                "full document is in "
                                "app/machining/examples/example_response.json."
                            ),
                            "value": SUCCESS_EXAMPLE,
                        },
                        "ambiguous": AMBIGUOUS_EXAMPLE,
                    }
                }
            },
        }
    }
