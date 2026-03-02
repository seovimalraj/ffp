# Bug Report - Manufacturing Quote Platform

## Summary of Findings

I've completed a comprehensive analysis of the app and identified several bugs and issues across all components. Here's what I found:

---

## 1. CAD Service Bugs

### File: `apps/cad-service/app/dfm_analyzer.py`

#### Bug 1: Inconsistent Process Configuration Handling
**Line 14-43 in `transform_holes_to_advanced_features()`**  
The function accepts `process_config` parameter but doesn't use it for:
- Min tool diameter calculation
- Max depth ratio calculation

**Current Implementation:**
```python
# Default thresholds
min_tool_diameter = 1.0  # mm
max_depth_ratio = 10.0
if process_config:
    min_tool_diameter = process_config.get("min_tool_diameter_mm", 1.0)
    max_depth_ratio = process_config.get("max_hole_depth_ratio", 10.0)
```

**Issue:** The default values are hardcoded and not properly overridden by process-specific configurations.

#### Bug 2: Depth Calculation Error
**Line 65 in `transform_holes_to_advanced_features()`**  
The function checks for deep holes using fixed ratio (5.0) instead of `max_depth_ratio` from config:

**Current Implementation:**
```python
# Check for deep holes (depth > 5x diameter = standard deep hole)
is_deep = depth_ratio > 5.0
if is_deep:
    deep_hole_count += 1
```

**Issue:** This ignores custom `max_depth_ratio` values from process configuration.

#### Bug 3: Material Configuration Not Used for Aspect Ratio Check
**Line 459 in `_analyze_dimensions()`**  
The aspect ratio check hardcodes to aluminum configuration:

**Current Implementation:**
```python
max_aspect = self.config["materials"]["aluminum"]["max_aspect_ratio"]
```

**Issue:** Should use material-specific configuration based on `material` parameter.

---

## 2. API Service Bugs

### File: `apps/api/src/materials/materials.controller.ts`

#### Bug 4: Inconsistent Table Names
**Lines 33 and 95**  
The `getMaterials()` method uses `Tables.GeneralMaterialsTable` while `getMinimalMaterials()` uses `Tables.MaterialTable`, causing potential inconsistencies.

#### Bug 5: No Error Handling for Material Creation
**Lines 254-269**  
The material creation endpoint inserts into two tables but doesn't handle transaction rollback if second insert fails.

---

## 3. Web App Bugs

### File: `apps/web/app/api/upload/cad/route.ts`

#### Bug 6: File Type Validation Issues
**Lines 23-52**  
File type validation has commented out MIME type checks and only relies on file extensions, which is insecure.

#### Bug 7: Unhandled Errors
**Line 104-107**  
The catch block logs errors but returns generic "File upload failed" message without details.

### File: `apps/web/app/dfm-analysis/page.tsx`

#### Bug 8: Duplicate File Validation Logic
**Lines 226-241**  
The file validation logic is duplicated in both client-side and server-side, potentially causing inconsistencies.

#### Bug 9: Missing Error Handling for File Upload
**Lines 367-449 in `handleSubmit()`**  
The upload process lacks detailed error handling for different failure scenarios.

---

## 4. Temporal Service Bugs

### File: `apps/api/src/temporal/temporal.service.ts`

#### Bug 10: No Retry Logic
**Lines 12-33**  
Temporal connection failure is logged but not retried, causing permanent service unavailability.

#### Bug 11: Hardcoded Address
**Line 17**  
Default Temporal address is hardcoded to `172.17.0.1:7233` which may not be correct for all environments.

---

## 5. Advanced Thickness Detection Bugs

### File: `apps/cad-service/app/core/advanced_thickness_detection.py`

#### Bug 12: Ray Casting Error Handling
**Lines 429-431**  
Exception handling catches all exceptions but returns generic error without preserving stack trace.

#### Bug 13: Division by Zero Risk
**Line 353**  
`consistency_ratio = std_dev / thickness if thickness > 0 else 1.0`  
There's a potential division by zero if `thickness` is 0.

---

## 6. Test File Issues

### File: `apps/cad-service/tests/test_dfm_analyzer.py`

#### Bug 14: Incomplete Test Coverage
**Lines 344-385**  
Tests only cover basic scenarios but miss edge cases like:
- Parts with no holes or pockets
- Extreme dimensions
- Invalid materials or processes

---

## High Priority Bugs

### 🔴 Critical Issues

1. **Material Configuration Not Used** (Bug 3) - Affects DFM analysis accuracy
2. **Inconsistent Process Configuration** (Bug 1) - Causes incorrect hole depth calculations  
3. **Temporal Connection Failures** (Bug 10) - Can bring down entire workflow system
4. **Missing Transaction Handling** (Bug 5) - Causes data inconsistencies

### 🟠 High Priority

1. **File Validation Inconsistencies** (Bug 6, Bug 8) - Security and usability issues
2. **Error Handling Deficiencies** (Bug 7, Bug 9) - Poor debugging and user experience
3. **Incomplete Test Coverage** (Bug 14) - Risks regression in production

---

## Solutions and Fixes

I'll now create a plan to fix these bugs systematically.
