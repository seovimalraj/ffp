# Secure File Handling Technical Reference

**Version:** 1.0  
**Date:** February 2026  
**Classification:** Security Technical Reference

---

## 1. Overview

This document describes the security architecture for CAD file handling in the FFP (Frigate Fast Parts) platform. File uploads are a critical attack surface; the system implements defense-in-depth to protect against malicious files, DoS attacks, and data exfiltration.

---

## 2. Security Architecture

### 2.1 Defense-in-Depth Layers

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    FILE SECURITY ARCHITECTURE                            │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │  LAYER 1: NETWORK & TRANSPORT                                      │ │
│  │  ├─ HTTPS/TLS 1.3 encryption in transit                           │ │
│  │  ├─ Rate limiting per IP/user                                     │ │
│  │  ├─ Request size limits at nginx/load balancer                    │ │
│  │  └─ WAF rules for common attack patterns                          │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                              ▼                                          │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │  LAYER 2: APPLICATION GATEWAY (API)                                │ │
│  │  ├─ Authentication required (AuthGuard)                           │ │
│  │  ├─ File presence validation                                      │ │
│  │  ├─ Extension whitelist enforcement                               │ │
│  │  └─ Multer streaming with size limits                             │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                              ▼                                          │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │  LAYER 3: STORAGE LAYER (Supabase)                                 │ │
│  │  ├─ Bucket-level access policies                                  │ │
│  │  ├─ Path sanitization                                             │ │
│  │  ├─ Content-type verification                                     │ │
│  │  └─ Signed URL generation for downloads                           │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                              ▼                                          │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │  LAYER 4: CAD SERVICE PROCESSING                                   │ │
│  │  ├─ URL scheme validation (http/https only)                       │ │
│  │  ├─ Download size limits (80 MB max)                              │ │
│  │  ├─ Timeout enforcement (30s)                                     │ │
│  │  ├─ Temporary file isolation                                      │ │
│  │  ├─ Geometry validation                                           │ │
│  │  └─ Automatic cleanup                                             │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 3. File Upload Security

### 3.1 API Layer Controls

```typescript
// files.controller.ts - Entry point security
@Controller('files')
@UseGuards(AuthGuard)  // Authentication required
export class FilesController {
  
  @Post()
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: CurrentUserDto,
  ) {
    // Validation 1: File presence
    if (!file) {
      throw new BadRequestException('File is required');
    }
    
    // Validation 2: User association
    const publicUrl = await this.supabaseService.uploadFile(
      file,
      BucketNames.rfqStore,
      undefined,
      {
        id: user.id,      // Audit trail
        role: user.role,  // RBAC enforcement
      },
    );
    // ...
  }
}
```

### 3.2 Allowed File Types

| Extension | MIME Type | Max Size | Notes |
|-----------|-----------|----------|-------|
| `.step` | `application/STEP` | 80 MB | Preferred CAD format |
| `.stp` | `application/STEP` | 80 MB | STEP alias |
| `.iges` | `model/iges` | 80 MB | Legacy CAD |
| `.igs` | `model/iges` | 80 MB | IGES alias |
| `.stl` | `model/stl` | 50 MB | Mesh format |
| `.dxf` | `image/vnd.dxf` | 20 MB | 2D flat patterns |

### 3.3 Extension Validation

```python
# Supported formats check
SUPPORTED_FORMATS = {'step', 'stp', 'iges', 'igs', 'stl', 'dxf'}

def validate_cad_file(request: DFMAnalysisRequest) -> List[DFMCheck]:
    """Validate CAD file format and perform basic checks"""
    file_extension = request.file_id.split('.')[-1].lower()
    
    if file_extension in SUPPORTED_FORMATS:
        return [DFMCheck(
            category="file_format",
            severity="info",
            message=f"{file_extension.upper()} file format is supported.",
            passed=True
        )]
    else:
        return [DFMCheck(
            category="file_format",
            severity="error",
            message=f"{file_extension.upper()} file format is not supported.",
            passed=False
        )]
```

---

## 4. Secure Download Handling

### 4.1 URL Validation

```python
# download.py - Secure URL fetching
def download_to_temp(url: str, *, max_bytes: int = 80 * 1024 * 1024) -> str:
    """Download a URL to a temporary file with security controls."""
    
    # SECURITY: URL scheme whitelist
    parsed = urllib.parse.urlparse(url)
    if parsed.scheme not in ("http", "https"):
        raise ValueError("Only http(s) URLs are supported")
    
    # SECURITY: Streaming with size limit
    with httpx.stream('GET', url, timeout=30.0) as r:
        r.raise_for_status()
        
        # Extract safe file extension
        suffix = os.path.splitext(parsed.path)[1].lower() or ""
        fd, path = tempfile.mkstemp(suffix=suffix)
        
        size = 0
        try:
            with os.fdopen(fd, "wb") as f:
                for chunk in r.iter_bytes():
                    if chunk:
                        size += len(chunk)
                        # SECURITY: Enforce size limit
                        if size > max_bytes:
                            raise ValueError("File exceeds maximum allowed size")
                        f.write(chunk)
        except Exception:
            # SECURITY: Cleanup on failure
            try:
                os.remove(path)
            finally:
                raise
    
    return path
```

### 4.2 Security Controls Summary

| Control | Value | Purpose |
|---------|-------|---------|
| **URL Scheme** | `http`, `https` only | Prevent SSRF via `file://`, `ftp://` |
| **Timeout** | 30 seconds | Prevent slowloris attacks |
| **Max Size** | 80 MB (configurable) | Prevent DoS via memory exhaustion |
| **Streaming** | Chunk-based | Never load full file to memory |
| **Cleanup** | Automatic on error | Prevent disk exhaustion |

---

## 5. Temporary File Security

### 5.1 Temporary File Lifecycle

```
┌─────────────────────────────────────────────────────────────────┐
│               TEMPORARY FILE LIFECYCLE                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. CREATE        tempfile.mkstemp(suffix='.step')              │
│        │          - Uses system temp directory                  │
│        │          - Unique filename (no collisions)             │
│        │          - Restrictive permissions (0600)              │
│        ▼                                                        │
│  2. PROCESS       load_step_shape(tmp_path)                     │
│        │          - Read-only access for loaders                │
│        │          - No execution of file contents               │
│        │          - Memory-mapped when possible                 │
│        ▼                                                        │
│  3. ANALYZE       extract_features(shape)                       │
│        │          - Geometry extracted to Python objects        │
│        │          - File no longer needed after this            │
│        ▼                                                        │
│  4. CLEANUP       os.unlink(tmp_path)                           │
│                   - Always in finally block                     │
│                   - Errors logged but don't propagate           │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 5.2 Cleanup Implementation

```python
# cad_features.py - Guaranteed cleanup
async def analyze_file(file: UploadFile):
    # Save uploaded file temporarily
    with tempfile.NamedTemporaryFile(delete=False, suffix=f'.{format}') as tmp:
        tmp_path = tmp.name
        content = await file.read()
        tmp.write(content)
    
    try:
        # Process the file
        result = extract_features(tmp_path)
        return result
    finally:
        # SECURITY: Always cleanup, even on exception
        if os.path.exists(tmp_path):
            os.unlink(tmp_path)
```

### 5.3 File Isolation

```python
# gltf.py - Isolated temp files for conversion
def convert_to_gltf(file_id: str, file_path: str):
    import tempfile
    
    # Create isolated temp file
    fd, tmp_stl = tempfile.mkstemp(suffix=".stl")
    try:
        os.close(fd)
        # Conversion happens here
        result = perform_conversion(file_path, tmp_stl)
    finally:
        # Always cleanup intermediate files
        if os.path.exists(tmp_stl):
            os.unlink(tmp_stl)
```

---

## 6. Input Validation

### 6.1 Geometry Validation Framework

```python
class GeometryValidator:
    """Comprehensive validation of extracted geometry data."""
    
    def __init__(self):
        # Define acceptable bounds
        self.min_volume_mm3 = 1.0          # Minimum: 1 mm³
        self.max_volume_mm3 = 1_000_000_000 # Maximum: 1 m³
        self.min_dimension_mm = 0.1         # Minimum: 0.1 mm
        self.max_dimension_mm = 10_000      # Maximum: 10 meters
        self.min_surface_area_mm2 = 1.0
        self.max_aspect_ratio = 1000

    def validate(self, geometry: Dict) -> ValidationResult:
        result = ValidationResult(is_valid=True, issues=[])
        
        # Check required fields exist
        self._validate_required_fields(geometry, result)
        
        # Validate numeric ranges
        self._validate_dimensions(geometry, result)
        self._validate_volume(geometry, result)
        self._validate_surface_area(geometry, result)
        
        # Physics consistency checks
        self._validate_geometric_consistency(geometry, result)
        
        # Process-specific validation
        self._validate_process_requirements(geometry, result)
        
        return result
```

### 6.2 Validation Severity Levels

| Severity | Effect | Example |
|----------|--------|---------|
| **INFO** | Logged, processing continues | "Using default tolerance" |
| **WARNING** | Alert raised, processing continues | "Extreme aspect ratio detected" |
| **ERROR** | Validation fails | "Volume exceeds maximum" |
| **CRITICAL** | Processing aborted | "Required field missing" |

### 6.3 Required Fields Validation

```python
def _validate_required_fields(self, geometry: Dict, result: ValidationResult):
    """Check that all required fields are present and valid."""
    required_fields = ["boundingBox", "volume", "surfaceArea"]
    
    for field in required_fields:
        if field not in geometry or geometry[field] is None:
            result.add_issue(ValidationIssue(
                severity=ValidationSeverity.CRITICAL,
                field=field,
                message=f"Required field '{field}' is missing or null"
            ))
    
    # Validate bounding box structure
    if "boundingBox" in geometry:
        bbox = geometry["boundingBox"]
        for axis in ["x", "y", "z"]:
            if axis not in bbox or bbox[axis] is None:
                result.add_issue(ValidationIssue(
                    severity=ValidationSeverity.CRITICAL,
                    field=f"boundingBox.{axis}",
                    message=f"Bounding box {axis} dimension is missing"
                ))
```

### 6.4 Physical Consistency Checks

```python
def _validate_geometric_consistency(self, geometry: Dict, result: ValidationResult):
    """Validate that measurements are physically possible."""
    bbox = geometry.get("boundingBox", {})
    volume = geometry.get("volume", 0)
    
    # Calculate envelope volume
    envelope_volume = bbox["x"] * bbox["y"] * bbox["z"]
    
    # SECURITY: Part volume cannot exceed bounding box
    if volume > envelope_volume * 1.01:  # 1% tolerance
        result.add_issue(ValidationIssue(
            severity=ValidationSeverity.ERROR,
            field="volume",
            message=f"Part volume ({volume}) exceeds bounding box ({envelope_volume})",
        ))
    
    # SECURITY: Volume efficiency sanity check
    volume_efficiency = volume / envelope_volume if envelope_volume > 0 else 0
    if volume_efficiency < 0.001:
        result.add_issue(ValidationIssue(
            severity=ValidationSeverity.WARNING,
            field="volume",
            message=f"Suspiciously low volume efficiency ({volume_efficiency * 100:.2f}%)"
        ))
```

---

## 7. Content Type Security

### 7.1 File Content Verification

The system does not trust file extensions alone:

```python
def verify_file_content(file_path: str, expected_extension: str) -> bool:
    """Verify file content matches expected type."""
    
    # STEP files start with ISO-10303 header
    if expected_extension in ('step', 'stp'):
        with open(file_path, 'r', errors='ignore') as f:
            header = f.read(1000)
            return 'ISO-10303' in header or 'FILE_DESCRIPTION' in header
    
    # STL files have ASCII or binary signatures
    if expected_extension == 'stl':
        with open(file_path, 'rb') as f:
            header = f.read(80)
            # Binary STL: skip header, check triangle count
            # ASCII STL: starts with "solid "
            return header.startswith(b'solid ') or len(f.read(4)) == 4
    
    # DXF files have section markers
    if expected_extension == 'dxf':
        with open(file_path, 'r', errors='ignore') as f:
            content = f.read(200)
            return 'SECTION' in content or 'HEADER' in content
    
    return True
```

---

## 8. Storage Security

### 8.1 Supabase Bucket Configuration

```typescript
// Bucket access policies
const bucketPolicies = {
  rfqStore: {
    public: false,           // No anonymous access
    allowedMimeTypes: [
      'application/STEP',
      'model/stl',
      'image/vnd.dxf',
      'model/iges'
    ],
    maxFileSize: 80 * 1024 * 1024,  // 80 MB
  }
};

// Upload with metadata
async uploadFile(file, bucket, path, metadata) {
  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(path, file.buffer, {
      contentType: file.mimetype,
      upsert: false,  // No overwrites
      metadata: {
        uploadedBy: metadata.id,
        uploadedAt: new Date().toISOString(),
      }
    });
}
```

### 8.2 File Integrity

```python
def sha256_of_file(path: str) -> str:
    """Compute SHA256 hash for integrity verification."""
    h = hashlib.sha256()
    with open(path, 'rb') as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b''):
            h.update(chunk)
    return h.hexdigest()
```

---

## 9. Rate Limiting & DoS Protection

### 9.1 Request Limits

| Resource | Limit | Window | Action |
|----------|-------|--------|--------|
| File uploads | 20/user | 1 hour | HTTP 429 |
| Analysis requests | 100/user | 1 hour | HTTP 429 |
| Download bandwidth | 1 GB/user | 1 day | Throttle |
| Concurrent analyses | 5/user | - | Queue |

### 9.2 Resource Limits

```python
# Processing timeouts
ANALYSIS_TIMEOUT = 120  # seconds
DOWNLOAD_TIMEOUT = 30   # seconds
MODEL_LOAD_TIMEOUT = 60 # seconds

# Memory guards
MAX_TRIANGLE_COUNT = 10_000_000  # 10M triangles
MAX_FACE_COUNT = 500_000         # 500K faces
MAX_SHAPE_COMPLEXITY = 1_000_000 # Operations
```

---

## 10. Audit Logging

### 10.1 Logged Events

| Event | Data Captured |
|-------|---------------|
| File Upload | user_id, file_hash, file_size, timestamp |
| File Download | user_id, file_id, ip_address, timestamp |
| Analysis Start | file_id, user_id, parameters |
| Analysis Complete | file_id, duration, result_summary |
| Validation Failure | file_id, failure_reason, severity |
| Security Event | event_type, details, client_info |

### 10.2 Log Format

```json
{
  "timestamp": "2026-02-21T10:30:45.123Z",
  "level": "INFO",
  "event": "file_upload",
  "user_id": "usr_abc123",
  "file_hash": "sha256:a1b2c3...",
  "file_size_bytes": 2456789,
  "file_extension": ".step",
  "ip_address": "192.168.1.100",
  "user_agent": "Mozilla/5.0...",
  "duration_ms": 234
}
```

---

## 11. Security Best Practices

### 11.1 Implementation Checklist

- [ ] Always use `finally` blocks for cleanup
- [ ] Never trust file extensions alone
- [ ] Validate all numeric inputs for range
- [ ] Use streaming for large files
- [ ] Implement request timeouts
- [ ] Log security-relevant events
- [ ] Hash files for integrity
- [ ] Use signed URLs for downloads
- [ ] Sanitize all file paths
- [ ] Enforce size limits at multiple layers

### 11.2 Common Attack Mitigations

| Attack | Mitigation |
|--------|------------|
| **Path Traversal** | Sanitize paths, use temp directories |
| **Zip Bombs** | Size limits, streaming, recursion limits |
| **XXE** | Disable external entities in parsers |
| **SSRF** | URL scheme whitelist, timeout |
| **DoS** | Rate limiting, resource limits |
| **Data Exfiltration** | Audit logging, signed URLs |

---

*Document maintained by FFP Tech Team*
