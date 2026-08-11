"""CAD metadata and PMI extraction.

Everything this module returns is *declared by the file*, and is tagged
``source = CAD_METADATA`` so a consumer can tell it apart from the measured
geometry (``source = GEOMETRY``). Nothing here is inferred from shape.

Two independent paths are used, because STEP files vary widely in what they
carry:

* **XCAF** - the structured route: product names, materials, and GD&T /
  datum entities when the exporter wrote them.
* **Header scan** - a bounded text scan of the STEP header and PRODUCT
  entities, which works even when no XCAF data exists.
"""

from __future__ import annotations

import logging
import re
from typing import Any, Dict, List, Optional, Sequence, Tuple

from . import occ
from .config import MachiningConfig
from .schemas import AnalysisWarning, InformationSource, PMIEntry, PMIInfo, WarningCode

logger = logging.getLogger(__name__)

#: Cap on the STEP prefix scanned for header metadata.
_HEADER_SCAN_BYTES = 256 * 1024

_FILE_NAME_RE = re.compile(r"FILE_NAME\s*\(\s*'([^']*)'", re.IGNORECASE)
_FILE_DESCRIPTION_RE = re.compile(r"FILE_DESCRIPTION\s*\(\s*\(\s*'([^']*)'", re.IGNORECASE)
_PRODUCT_RE = re.compile(r"PRODUCT\s*\(\s*'([^']*)'\s*,\s*'([^']*)'", re.IGNORECASE)
_REVISION_RE = re.compile(
    r"PRODUCT_DEFINITION_FORMATION(?:_WITH_SPECIFIED_SOURCE)?\s*\(\s*'([^']*)'",
    re.IGNORECASE,
)
_MATERIAL_RE = re.compile(
    r"(?:MATERIAL|MATERIAL_DESIGNATION|MATERIAL_PROPERTY)\s*\(\s*'([^']*)'", re.IGNORECASE
)
_SURFACE_FINISH_RE = re.compile(
    r"(Ra\s*\d+(?:\.\d+)?|Rz\s*\d+(?:\.\d+)?|N\d{1,2}\b)", re.IGNORECASE
)
_DATUM_RE = re.compile(r"DATUM\s*\(\s*'([^']*)'", re.IGNORECASE)
_GDT_RE = re.compile(
    r"\b(FLATNESS|STRAIGHTNESS|CIRCULARITY|CYLINDRICITY|PROFILE|ANGULARITY|"
    r"PERPENDICULARITY|PARALLELISM|POSITION|CONCENTRICITY|SYMMETRY|"
    r"CIRCULAR_RUNOUT|TOTAL_RUNOUT)_TOLERANCE\s*\(\s*'([^']*)'",
    re.IGNORECASE,
)


class PMIExtractor:
    """Reads declared metadata without ever inferring it from geometry."""

    def __init__(self, config: MachiningConfig):
        self.config = config

    def extract(
        self, path: str, file_format: str, warnings: List[AnalysisWarning]
    ) -> PMIInfo:
        info = PMIInfo()
        entries: List[PMIEntry] = []

        if file_format == "STEP":
            self._scan_header(path, info, entries)
            self._read_xcaf(path, info, entries, warnings)
        else:
            warnings.append(
                AnalysisWarning(
                    code=WarningCode.PMI_UNAVAILABLE,
                    message=(
                        f"{file_format} carries no structured PMI; only geometry "
                        "was analysed."
                    ),
                )
            )

        info.raw = entries
        info.available = bool(
            entries
            or info.part_name
            or info.material
            or info.gdt
            or info.datums
            or info.feature_names
        )
        if not info.available:
            warnings.append(
                AnalysisWarning(
                    code=WarningCode.PMI_UNAVAILABLE,
                    message=(
                        "No CAD metadata or PMI found. Every value in this "
                        "response is measured from geometry."
                    ),
                )
            )
        return info

    # -- header scan -------------------------------------------------------

    def _scan_header(
        self, path: str, info: PMIInfo, entries: List[PMIEntry]
    ) -> None:
        """Read a bounded prefix of the STEP file for declared strings.

        Only the first :data:`_HEADER_SCAN_BYTES` are read so a 500 MB STEP file
        never lands in memory.
        """
        try:
            with open(path, "r", encoding="utf-8", errors="replace") as fh:
                text = fh.read(_HEADER_SCAN_BYTES)
        except OSError as exc:
            logger.warning("STEP header scan failed: %s", exc)
            return

        match = _FILE_NAME_RE.search(text)
        if match and match.group(1).strip():
            entries.append(PMIEntry(key="file_name", value=match.group(1).strip()))

        match = _FILE_DESCRIPTION_RE.search(text)
        if match and match.group(1).strip():
            entries.append(PMIEntry(key="file_description", value=match.group(1).strip()))

        products = _PRODUCT_RE.findall(text)
        if products:
            part_number, part_name = products[0]
            info.part_number = part_number.strip() or None
            info.part_name = (part_name.strip() or part_number.strip()) or None
            entries.append(PMIEntry(key="product_id", value=part_number.strip()))
            entries.append(PMIEntry(key="product_name", value=part_name.strip()))
            # Later PRODUCT entities name sub-components / features.
            info.feature_names.extend(
                sorted({name.strip() for _, name in products[1:] if name.strip()})
            )

        match = _REVISION_RE.search(text)
        if match and match.group(1).strip():
            info.revision = match.group(1).strip()
            entries.append(PMIEntry(key="revision", value=info.revision))

        match = _MATERIAL_RE.search(text)
        if match and match.group(1).strip():
            info.material = match.group(1).strip()
            entries.append(PMIEntry(key="material", value=info.material))

        match = _SURFACE_FINISH_RE.search(text)
        if match:
            info.surface_finish = match.group(1).strip()
            entries.append(PMIEntry(key="surface_finish", value=info.surface_finish))

        datums = sorted({d.strip() for d in _DATUM_RE.findall(text) if d.strip()})
        if datums:
            info.datums.extend(datums)

        for kind, label in _GDT_RE.findall(text):
            info.gdt.append(
                {
                    "type": kind.upper(),
                    "label": label.strip(),
                    "source": InformationSource.CAD_METADATA.value,
                }
            )

    # -- XCAF --------------------------------------------------------------

    def _read_xcaf(
        self,
        path: str,
        info: PMIInfo,
        entries: List[PMIEntry],
        warnings: List[AnalysisWarning],
    ) -> None:
        """Pull structured names and materials from the XCAF document tree."""
        if occ.STEPCAFControl_Reader is None or occ.TDocStd_Document is None:
            return
        try:
            doc = self._new_document()
            reader = occ.STEPCAFControl_Reader()
            reader.SetNameMode(True)
            reader.SetColorMode(True)
            reader.SetMatMode(True)
            if hasattr(reader, "SetGDTMode"):
                reader.SetGDTMode(True)

            status = reader.ReadFile(path)
            if status != occ.IFSelect_RetDone:
                return
            if not reader.Transfer(doc):
                return

            names = self._collect_names(doc)
            if names:
                existing = set(info.feature_names)
                info.feature_names.extend(
                    name for name in names if name not in existing
                )
                entries.append(PMIEntry(key="xcaf_label_names", value=names))

            material = self._collect_material(doc)
            if material and not info.material:
                info.material = material
                entries.append(PMIEntry(key="material", value=material))
        except Exception as exc:
            logger.info("XCAF metadata extraction skipped: %s", exc)

    def _new_document(self) -> Any:
        """Create a TDocStd_Document across binding signature differences."""
        try:
            return occ.TDocStd_Document(occ.TCollection_ExtendedString("MDTV-XCAF"))
        except Exception:
            return occ.TDocStd_Document("MDTV-XCAF")

    def _collect_names(self, doc: Any) -> List[str]:
        """Names attached to free shapes and their sub-components."""
        if occ.XCAFDoc_DocumentTool is None or occ.TDF_LabelSequence is None:
            return []
        try:
            shape_tool = occ.XCAFDoc_DocumentTool.ShapeTool(doc.Main())
            labels = occ.TDF_LabelSequence()
            shape_tool.GetFreeShapes(labels)
        except Exception as exc:
            logger.debug("XCAF shape tool unavailable: %s", exc)
            return []

        names: List[str] = []
        seen = set()

        def visit(label: Any, depth: int = 0) -> None:
            if depth > 8:
                return
            name = self._label_name(label)
            if name and name not in seen:
                seen.add(name)
                names.append(name)
            try:
                children = occ.TDF_LabelSequence()
                shape_tool.GetComponents(label, children)
                for i in range(1, children.Length() + 1):
                    visit(children.Value(i), depth + 1)
            except Exception:
                return

        try:
            for i in range(1, labels.Length() + 1):
                visit(labels.Value(i))
        except Exception as exc:
            logger.debug("XCAF label walk failed: %s", exc)
        return sorted(names)

    def _label_name(self, label: Any) -> Optional[str]:
        if occ.TDataStd_Name is None:
            return None
        try:
            attribute = occ.TDataStd_Name()
            if not label.FindAttribute(occ.TDataStd_Name.GetID(), attribute):
                return None
            return str(attribute.Get()).strip() or None
        except Exception:
            return None

    def _collect_material(self, doc: Any) -> Optional[str]:
        try:
            material_tool = occ.XCAFDoc_DocumentTool.MaterialTool(doc.Main())
            labels = occ.TDF_LabelSequence()
            material_tool.GetMaterialLabels(labels)
            for i in range(1, labels.Length() + 1):
                name = self._label_name(labels.Value(i))
                if name:
                    return name
        except Exception as exc:
            logger.debug("XCAF material tool unavailable: %s", exc)
        return None


def thread_name_candidates(info: PMIInfo) -> List[str]:
    """Strings from CAD metadata that may carry a thread designation."""
    candidates: List[str] = []
    candidates.extend(info.feature_names)
    if info.part_name:
        candidates.append(info.part_name)
    for entry in info.raw:
        if isinstance(entry.value, str):
            candidates.append(entry.value)
        elif isinstance(entry.value, (list, tuple)):
            candidates.extend(str(v) for v in entry.value)
    for item in info.gdt:
        label = item.get("label")
        if label:
            candidates.append(str(label))
    return candidates
