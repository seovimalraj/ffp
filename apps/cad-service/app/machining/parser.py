"""CAD file intake: safe upload handling, import and shape validation."""

from __future__ import annotations

import hashlib
import logging
import os
import re
import tempfile
from dataclasses import dataclass, field
from pathlib import PurePath
from typing import Any, Dict, List, Optional, Tuple

from . import convert, occ
from .config import MachiningConfig, get_machining_config
from .schemas import AnalysisWarning, WarningCode

logger = logging.getLogger(__name__)

#: Extension -> canonical format label.
#:
#: PARASOLID is read through an external converter rather than by the kernel
#: (see :mod:`convert`), so it is only offered when one is configured. Use
#: :func:`available_formats` for the list a given deployment can actually take.
SUPPORTED_FORMATS = {
    ".step": "STEP",
    ".stp": "STEP",
    ".iges": "IGES",
    ".igs": "IGES",
    ".brep": "BREP",
    ".brp": "BREP",
    ".x_t": "PARASOLID",
    ".x_b": "PARASOLID",
    ".xmt_txt": "PARASOLID",
    ".xmt_bin": "PARASOLID",
}

_SAFE_NAME = re.compile(r"[^A-Za-z0-9._-]+")


class CADParseError(Exception):
    """Raised for any client-correctable problem with the submitted file."""

    def __init__(self, code: str, message: str, status_code: int = 400):
        super().__init__(message)
        self.code = code
        self.message = message
        self.status_code = status_code


@dataclass
class LoadedModel:
    """A successfully imported and validated shape."""

    shape: Any
    filename: str
    file_format: str
    file_size_bytes: int
    sha256: str
    path: str
    warnings: List[AnalysisWarning] = field(default_factory=list)
    is_valid: bool = True


def sanitize_filename(raw: Optional[str]) -> str:
    """Reduce a client-supplied filename to a safe basename.

    The result is used only for reporting and to pick a temp-file suffix - it
    never becomes part of a filesystem path we open. Path separators, parent
    references, NUL bytes and drive letters are all stripped.
    """
    if not raw:
        return "upload"
    # PurePath handles both separators; take the last component only.
    base = PurePath(raw.replace("\\", "/")).name
    base = base.replace("\x00", "")
    base = _SAFE_NAME.sub("_", base).strip("._")
    if not base or base in (".", ".."):
        return "upload"
    return base[:180]


def extension_of(filename: str) -> str:
    return os.path.splitext(filename)[1].lower()


def _brep_available() -> bool:
    return not (occ.breptools is None and occ.BRepTools is None)


def available_formats(config: Optional[MachiningConfig] = None) -> Dict[str, str]:
    """The subset of :data:`SUPPORTED_FORMATS` this deployment can actually read.

    BREP depends on the kernel build and PARASOLID on a configured converter,
    so advertising the static table would promise more than the service can do.
    """
    cfg = config or get_machining_config()
    formats = dict(SUPPORTED_FORMATS)
    if not _brep_available():
        formats = {e: f for e, f in formats.items() if f != "BREP"}
    if not convert.converter_configured(cfg):
        formats = {e: f for e, f in formats.items() if f != "PARASOLID"}
    return formats


def validate_extension(filename: str, config: Optional[MachiningConfig] = None) -> str:
    """Return the canonical format label, raising for unsupported extensions."""
    ext = extension_of(filename)
    fmt = SUPPORTED_FORMATS.get(ext)
    if fmt is None:
        raise CADParseError(
            "UNSUPPORTED_FORMAT",
            (
                f"Unsupported file extension '{ext or '(none)'}'. Supported: "
                f"{', '.join(sorted(available_formats(config)))}."
            ),
            status_code=415,
        )
    if fmt == "BREP" and not _brep_available():
        raise CADParseError(
            "UNSUPPORTED_FORMAT",
            "BREP import is not available in the installed CAD kernel build.",
            status_code=415,
        )
    if fmt == "PARASOLID":
        cfg = config or get_machining_config()
        if not convert.converter_configured(cfg):
            # Refused here, before a byte of the body is read, so the user is
            # not made to wait on a 100 MB upload that cannot be parsed.
            raise CADParseError(
                "PARASOLID_CONVERTER_UNAVAILABLE",
                (
                    f"'{ext}' is a Parasolid file. OpenCASCADE cannot read "
                    "Parasolid, and no external converter is configured on "
                    "this deployment. Export the part as STEP (AP214/AP242) "
                    "and upload that, or set "
                    "MACHINING_PARASOLID_CONVERTER_CMD to enable conversion."
                ),
                status_code=415,
            )
    return fmt


class CADParser:
    """Streams an upload to disk, imports it with OCCT, and validates the result."""

    def __init__(self, config: MachiningConfig):
        self.config = config

    # -- upload ------------------------------------------------------------

    async def stream_upload_to_temp(self, upload: Any, filename: str) -> Tuple[str, int, str]:
        """Write ``upload`` to a temp file in chunks.

        Returns ``(path, size_bytes, sha256)``. The file is never held whole in
        memory, and the size cap is enforced while streaming so an oversized
        upload is abandoned early rather than after a full read. The temp path
        is generated by :mod:`tempfile`, never derived from client input.
        """
        suffix = extension_of(filename)
        fd, path = tempfile.mkstemp(prefix="machining-", suffix=suffix)
        digest = hashlib.sha256()
        size = 0
        try:
            with os.fdopen(fd, "wb") as out:
                while True:
                    chunk = await upload.read(self.config.upload_chunk_bytes)
                    if not chunk:
                        break
                    size += len(chunk)
                    if size > self.config.max_upload_bytes:
                        raise CADParseError(
                            "FILE_TOO_LARGE",
                            (
                                f"File exceeds the {self.config.max_upload_bytes} byte "
                                "limit."
                            ),
                            status_code=413,
                        )
                    digest.update(chunk)
                    out.write(chunk)
        except BaseException:
            remove_quietly(path)
            raise

        if size == 0:
            remove_quietly(path)
            raise CADParseError("EMPTY_FILE", "The uploaded file is empty.")

        return path, size, digest.hexdigest()

    # -- import ------------------------------------------------------------

    def load(self, path: str, filename: str, size_bytes: int, sha256: str) -> LoadedModel:
        """Import ``path`` and validate that it holds usable solid geometry."""
        occ.require_kernel()
        file_format = validate_extension(filename, self.config)
        warnings: List[AnalysisWarning] = []

        self._force_millimetre_units()

        if file_format == "PARASOLID":
            # The kernel never sees the Parasolid file: it is converted to
            # STEP first and the STEP is what gets read.
            shape = self._read_parasolid(path, warnings)
        elif file_format == "STEP":
            shape = self._read_step(path)
        elif file_format == "IGES":
            shape = self._read_iges(path)
        else:
            shape = self._read_brep(path)

        if shape is None or shape.IsNull():
            raise CADParseError(
                "CORRUPT_CAD_FILE",
                "The CAD file was read but produced no geometry. It may be "
                "corrupt or contain only non-geometric entities.",
            )

        shape = self._ensure_solid(shape, file_format, warnings)
        is_valid = self._check_validity(shape, warnings)

        return LoadedModel(
            shape=shape,
            filename=filename,
            file_format=file_format,
            file_size_bytes=size_bytes,
            sha256=sha256,
            path=path,
            warnings=warnings,
            is_valid=is_valid,
        )

    # -- readers -----------------------------------------------------------

    def _force_millimetre_units(self) -> None:
        """Pin the STEP reader to millimetres so output units are deterministic.

        STEP files declare their own unit; OCCT converts to whatever
        ``xstep.cascade.unit`` says. Setting it explicitly means an inch-based
        file and a millimetre-based file of the same part both yield identical
        millimetre output.
        """
        if occ.Interface_Static is None:
            return
        try:
            setter = getattr(occ.Interface_Static, "SetCVal", None)
            if setter is not None:
                setter("xstep.cascade.unit", "MM")
        except Exception as exc:  # pragma: no cover - binding dependent
            logger.debug("Could not pin STEP units to MM: %s", exc)

    def _read_step(self, path: str):
        reader = occ.STEPControl_Reader()
        status = reader.ReadFile(path)
        if status != occ.IFSelect_RetDone:
            raise CADParseError(
                "CORRUPT_CAD_FILE",
                f"STEP import failed (OCCT status {int(status)}). The file is "
                "not a readable STEP document.",
            )
        roots = reader.TransferRoots()
        if not roots:
            raise CADParseError(
                "CORRUPT_CAD_FILE",
                "STEP file contains no transferable root entities.",
            )
        return reader.OneShape()

    def _read_parasolid(self, path: str, warnings: List[AnalysisWarning]):
        """Convert a Parasolid file to STEP, read it, then drop the scratch copy.

        The conversion is recorded as a warning rather than passed over in
        silence: the geometry that was measured is the converter's STEP, not
        the file the user uploaded, and any translation loss belongs to the
        converter.
        """
        try:
            result = convert.to_step(path, self.config)
        except convert.ConversionError as exc:
            raise CADParseError(exc.code, exc.message, exc.status_code) from exc

        try:
            shape = self._read_step(result.path)
        except CADParseError as exc:
            # The converter succeeded but produced STEP the kernel rejects -
            # a converter problem, not a bad upload, so say which stage failed.
            raise CADParseError(
                "CONVERSION_FAILED",
                (
                    "The Parasolid file was converted, but the resulting STEP "
                    f"could not be read: {exc.message}"
                ),
                status_code=422,
            ) from exc
        finally:
            result.cleanup()

        warnings.append(
            AnalysisWarning(
                code=WarningCode.FORMAT_CONVERTED,
                message=(
                    "Parasolid has no native kernel reader, so the file was "
                    "converted to STEP before analysis. Results describe the "
                    "converted geometry; check anything dimensionally critical "
                    "against the source model."
                ),
                detail={
                    "source_format": result.source_format,
                    "converted_to": "STEP",
                    "converter": os.path.basename(result.command[0]),
                    "conversion_duration_ms": result.duration_ms,
                },
            )
        )
        return shape

    def _read_iges(self, path: str):
        reader = occ.IGESControl_Reader()
        status = reader.ReadFile(path)
        if status != occ.IFSelect_RetDone:
            raise CADParseError(
                "CORRUPT_CAD_FILE",
                f"IGES import failed (OCCT status {int(status)}).",
            )
        reader.TransferRoots()
        return reader.OneShape()

    def _read_brep(self, path: str):
        shape = occ.TopoDS_Shape()
        builder_mod = None
        try:
            import importlib

            root = "OCP" if occ.kernel_name() == "OCP" else "OCC.Core"
            builder_mod = importlib.import_module(f"{root}.BRep")
        except Exception as exc:
            raise CADParseError(
                "CORRUPT_CAD_FILE", f"BREP import unavailable: {exc}", status_code=415
            )
        builder = builder_mod.BRep_Builder()
        holder = occ.breptools or occ.BRepTools
        read = getattr(holder, "Read", None)
        if read is None:
            raise CADParseError(
                "CORRUPT_CAD_FILE",
                "BRepTools.Read unavailable in this kernel build.",
                status_code=415,
            )
        ok = read(shape, path, builder)
        if ok is False:
            raise CADParseError("CORRUPT_CAD_FILE", "BREP import failed.")
        return shape

    # -- validation --------------------------------------------------------

    def _check_validity(self, shape, warnings: List[AnalysisWarning]) -> bool:
        """Run ``BRepCheck_Analyzer``; a failure is a warning, not a rejection.

        Imported STEP is frequently imperfect yet still perfectly measurable, so
        invalid geometry is reported rather than used to reject the request.
        """
        if occ.BRepCheck_Analyzer is None:
            return True
        try:
            valid = bool(occ.BRepCheck_Analyzer(shape).IsValid())
        except Exception as exc:
            logger.warning("BRepCheck_Analyzer raised: %s", exc)
            return True
        if not valid:
            warnings.append(
                AnalysisWarning(
                    code=WarningCode.INVALID_GEOMETRY,
                    message=(
                        "The kernel reports invalid B-Rep geometry. Measurements "
                        "are still returned but may be unreliable."
                    ),
                )
            )
        return valid

    def _ensure_solid(self, shape, file_format: str, warnings: List[AnalysisWarning]):
        """Return a shape containing at least one solid, repairing if needed.

        A STEP file that carries only shells is usually a solid whose faces
        were never sewn - a routine export artefact rather than unusable
        geometry. Sewing is attempted first, and only a genuine surface model
        (one that cannot be closed) is rejected.
        """
        solids = list(occ.iter_unique_shapes(shape, occ.TopAbs_SOLID))
        shells = list(occ.iter_unique_shapes(shape, occ.TopAbs_SHELL))
        faces = list(occ.iter_unique_shapes(shape, occ.TopAbs_FACE))

        if not solids and faces and self.config.repair_open_shells:
            if len(faces) > self.config.max_faces:
                raise CADParseError(
                    "MODEL_TOO_COMPLEX",
                    (
                        f"The model has {len(faces)} faces, above the "
                        f"{self.config.max_faces} face limit for this endpoint."
                    ),
                    status_code=422,
                )
            repaired = self._sew_into_solids(shape)
            if repaired is not None:
                rebuilt = list(occ.iter_unique_shapes(repaired, occ.TopAbs_SOLID))
                warnings.append(
                    AnalysisWarning(
                        code=WarningCode.GEOMETRY_REPAIRED,
                        message=(
                            f"The file contained {len(shells)} shell(s) and no "
                            f"solid. The faces were sewn into {len(rebuilt)} "
                            "solid(s) before analysis. Volume and any result "
                            "that depends on it should be sanity-checked "
                            "against the source model."
                        ),
                        detail={
                            "shells_in_file": len(shells),
                            "solids_after_repair": len(rebuilt),
                            "sew_tolerance_mm": self.config.sew_tolerance_mm,
                        },
                    )
                )
                shape = repaired
                solids = rebuilt

        self._require_solid(shape, file_format, warnings, solids, shells, faces)
        return shape

    def _sew_into_solids(self, shape):
        """Sew loose faces and upgrade the resulting shells to solids.

        Returns the repaired shape, or ``None`` when nothing could be closed.
        """
        if occ.BRepBuilderAPI_Sewing is None or occ.ShapeFix_Solid is None:
            logger.info("Shape healing unavailable in this kernel build")
            return None
        try:
            sewing = occ.BRepBuilderAPI_Sewing(self.config.sew_tolerance_mm)
            sewing.Add(shape)
            sewing.Perform()
            sewn = sewing.SewedShape()
        except Exception as exc:
            logger.warning("Sewing failed: %s", exc)
            return None

        solids = []
        for raw_shell in occ.iter_unique_shapes(sewn, occ.TopAbs_SHELL):
            try:
                solid = occ.ShapeFix_Solid().SolidFromShell(occ.to_shell(raw_shell))
            except Exception as exc:
                logger.debug("SolidFromShell failed: %s", exc)
                continue
            if solid is None or solid.IsNull():
                continue
            # A shell that could not be closed comes back as a shell, not a
            # solid; only count genuine solids.
            if list(occ.iter_unique_shapes(solid, occ.TopAbs_SOLID)):
                solids.append(solid)

        if not solids:
            return None
        try:
            return solids[0] if len(solids) == 1 else occ.make_compound(solids)
        except Exception as exc:
            logger.warning("Could not assemble repaired solids: %s", exc)
            return solids[0]

    def _require_solid(
        self,
        shape,
        file_format: str,
        warnings: List[AnalysisWarning],
        solids,
        shells,
        faces,
    ) -> None:
        """Reject models with no solid; warn (never silently ignore) on many."""
        if not solids:
            if shells or faces:
                raise CADParseError(
                    "NO_SOLID_GEOMETRY",
                    (
                        f"The model contains {len(shells)} shell(s) and "
                        f"{len(faces)} face(s) but no closed solid, and sewing "
                        f"them at {self.config.sew_tolerance_mm} mm did not "
                        "close the volume. This is a surface model, or its "
                        "faces have gaps wider than the sewing tolerance. "
                        "Re-export as a solid, or retry with a larger "
                        "MACHINING_SEW_TOLERANCE_MM."
                        + (
                            " Note that IGES is a surface format and often has "
                            "no solid to export."
                            if file_format == "IGES"
                            else ""
                        )
                    ),
                    status_code=422,
                )
            raise CADParseError(
                "NO_SOLID_GEOMETRY",
                "The model contains no solid, shell or face geometry.",
                status_code=422,
            )

        if len(solids) > 1:
            warnings.append(
                AnalysisWarning(
                    code=WarningCode.MULTIPLE_SOLIDS,
                    message=(
                        f"The model contains {len(solids)} separate solid bodies. "
                        "All bodies were analysed together; feature counts and "
                        "stock estimates span the whole assembly."
                    ),
                    detail={"solid_count": len(solids)},
                )
            )

        if len(faces) > self.config.max_faces:
            raise CADParseError(
                "MODEL_TOO_COMPLEX",
                (
                    f"The model has {len(faces)} faces, above the "
                    f"{self.config.max_faces} face limit for this endpoint."
                ),
                status_code=422,
            )


def remove_quietly(path: Optional[str]) -> None:
    """Delete a temp file, ignoring races and permission errors."""
    if not path:
        return
    try:
        os.remove(path)
    except (FileNotFoundError, PermissionError, OSError) as exc:
        logger.debug("Temp file %s not removed: %s", path, exc)
