"""
DFM Configuration Loader
Loads and validates manufacturing configuration from dfm_config.json
"""
import json
import os
from typing import Any, Dict, Optional

_CONFIG_CACHE: Optional[Dict[str, Any]] = None


def _default_config() -> Dict[str, Any]:
    """Fallback config when dfm_config.json is unavailable."""
    return {
        "version": "1.0.0",
        "materials": {
            "aluminum": {
                "name": "aluminum",
                "min_wall_thickness_mm": 1.0,
                "min_hole_diameter_mm": 1.0,
                "max_slenderness_ratio": 15.0,
                "max_boss_ratio": 4.0,
                "min_corner_radius_mm": 0.5,
            },
            "steel": {
                "name": "steel",
                "min_wall_thickness_mm": 0.8,
                "min_hole_diameter_mm": 1.0,
                "max_slenderness_ratio": 12.0,
                "max_boss_ratio": 3.0,
                "min_corner_radius_mm": 0.5,
            },
            "plastic": {
                "name": "plastic",
                "min_wall_thickness_mm": 1.5,
                "min_hole_diameter_mm": 2.0,
                "max_slenderness_ratio": 8.0,
                "max_boss_ratio": 2.0,
                "min_corner_radius_mm": 1.0,
            },
        },
        "processes": {
            "cnc_milling": {
                "name": "cnc_milling",
                "max_travel_mm": {"x": 1000.0, "y": 500.0, "z": 300.0},
                "max_finish_size_mm": 500.0,
                "min_tool_diameter_mm": 1.0,
                "max_hole_depth_ratio": 10.0,
                "max_pocket_depth_ratio": 4.0,
                "min_slot_width_mm": 2.0,
            },
            "cnc_turning": {
                "name": "cnc_turning",
                "max_travel_mm": {"x": 500.0, "y": 300.0, "z": 300.0},
                "max_finish_size_mm": 300.0,
                "min_tool_diameter_mm": 0.5,
                "max_hole_depth_ratio": 8.0,
                "max_pocket_depth_ratio": 3.0,
                "min_slot_width_mm": 1.5,
            },
        },
        "rules": [],
        "global_thresholds": {
            "max_shell_count": 2,
            "min_clamp_area_mm2": 1000,
            "max_web_slenderness": 20.0,
            "min_thread_diameter_mm": 3.0,
        },
    }


def load_dfm_config(config_path: Optional[str] = None) -> Dict[str, Any]:
    """
    Load DFM configuration from dfm_config.json.

    Searches for the config file in this order:
    1. Explicit path (if provided)
    2. Same directory as this module (app/dfm_config.json)
    3. Falls back to built-in defaults

    Results are cached after first load.

    Args:
        config_path: Optional explicit path to dfm_config.json

    Returns:
        Configuration dictionary
    """
    global _CONFIG_CACHE
    if _CONFIG_CACHE is not None:
        return _CONFIG_CACHE

    # Determine config file path
    if config_path and os.path.isfile(config_path):
        target = config_path
    else:
        module_dir = os.path.dirname(os.path.abspath(__file__))
        target = os.path.join(module_dir, "dfm_config.json")

    try:
        with open(target, "r") as f:
            config = json.load(f)
        # Basic schema validation
        if "materials" not in config or "processes" not in config:
            print(f"[dfm_config] WARNING: Config at {target} missing required keys, using defaults")
            config = _default_config()
        _CONFIG_CACHE = config
        return config
    except FileNotFoundError:
        print(f"[dfm_config] Config file not found at {target}, using defaults")
        _CONFIG_CACHE = _default_config()
        return _CONFIG_CACHE
    except json.JSONDecodeError as e:
        print(f"[dfm_config] Invalid JSON in {target}: {e}, using defaults")
        _CONFIG_CACHE = _default_config()
        return _CONFIG_CACHE


def get_material_config(material: str) -> Dict[str, Any]:
    """
    Get configuration for a specific material.

    Args:
        material: Material name (e.g. 'aluminum', 'steel', 'plastic')

    Returns:
        Material config dict, falls back to aluminum if material not found
    """
    config = load_dfm_config()
    materials = config.get("materials", {})
    if material in materials:
        return materials[material]
    # Fall back to aluminum as default
    return materials.get("aluminum", {})


def get_process_config(process: str) -> Dict[str, Any]:
    """
    Get configuration for a specific manufacturing process.

    Args:
        process: Process name (e.g. 'cnc_milling', 'cnc_turning')

    Returns:
        Process config dict, falls back to cnc_milling if process not found
    """
    config = load_dfm_config()
    processes = config.get("processes", {})
    if process in processes:
        return processes[process]
    return processes.get("cnc_milling", {})


def get_global_thresholds() -> Dict[str, Any]:
    """Get global threshold values."""
    config = load_dfm_config()
    return config.get("global_thresholds", {})


def reload_config(config_path: Optional[str] = None) -> Dict[str, Any]:
    """Force reload configuration (clears cache)."""
    global _CONFIG_CACHE
    _CONFIG_CACHE = None
    return load_dfm_config(config_path)
