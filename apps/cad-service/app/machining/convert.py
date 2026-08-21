"""External-converter bridge for formats OpenCASCADE cannot read natively.

OCCT ships no Parasolid translator, so a ``.x_t``/``.x_b`` upload can only be
analysed by handing it to something that emits STEP first. No converter is
bundled here on purpose: every Parasolid translator is either licensed
(CAD Exchanger, Datakit, OCCT Advanced Data Exchange) or site-specific, which
makes the command configuration rather than code.

Point ``MACHINING_PARASOLID_CONVERTER_CMD`` at a converter and the format
becomes available; leave it unset and Parasolid uploads are refused up front
with a message telling the user to export STEP instead.

The template names its placeholders, so argument order is the operator's
choice::

    MACHINING_PARASOLID_CONVERTER_CMD='cadex_convert -i {input} -o {output}'
    MACHINING_PARASOLID_CONVERTER_CMD='/opt/dk/x_t2step {input} {output} --units mm'

The command is split into argv *before* the paths are substituted and is run
with ``shell=False``, so no part of a filename can ever be read as shell
syntax.
"""

from __future__ import annotations

import logging
import os
import shlex
import shutil
import subprocess
import tempfile
import time
from dataclasses import dataclass
from typing import List, Optional

from .config import MachiningConfig

logger = logging.getLogger(__name__)

#: Placeholders a converter template must contain.
INPUT_TOKEN = "{input}"
OUTPUT_TOKEN = "{output}"

_STDERR_TAIL_CHARS = 500


class ConversionError(Exception):
    """A conversion that could not be performed.

    Mirrors ``CADParseError``'s shape so the parser can re-raise it as one
    without this module having to import from :mod:`parser` (which imports
    this one).
    """

    def __init__(self, code: str, message: str, status_code: int = 422):
        super().__init__(message)
        self.code = code
        self.message = message
        self.status_code = status_code


@dataclass
class ConversionResult:
    """A converted STEP file plus the scratch directory holding it."""

    path: str
    workdir: str
    command: List[str]
    duration_ms: int
    source_format: str

    def cleanup(self) -> None:
        """Remove the scratch directory. Safe to call more than once."""
        shutil.rmtree(self.workdir, ignore_errors=True)


def converter_command(config: MachiningConfig) -> str:
    return (config.parasolid_converter_cmd or "").strip()


def converter_configured(config: MachiningConfig) -> bool:
    """True when a Parasolid converter has been configured for this deployment."""
    return bool(converter_command(config))


def parse_command(template: str) -> List[str]:
    """Split a command template into argv without touching the placeholders.

    POSIX splitting eats the backslashes in ``C:\\tools\\conv.exe``, so Windows
    uses non-POSIX mode and has its surrounding quotes stripped afterwards.
    """
    tokens = shlex.split(template, posix=(os.name != "nt"))
    if os.name == "nt":
        tokens = [
            token[1:-1]
            if len(token) >= 2 and token[0] == '"' and token[-1] == '"'
            else token
            for token in tokens
        ]
    return tokens


def build_command(template: str, input_path: str, output_path: str) -> List[str]:
    """Return the argv for ``template`` with the paths substituted in.

    Substitution happens per-token after the split, so a path containing
    spaces, quotes or semicolons stays exactly one argument.
    """
    tokens = parse_command(template)
    if not tokens:
        raise ConversionError(
            "PARASOLID_CONVERTER_MISCONFIGURED",
            "The configured Parasolid converter command is empty.",
            status_code=500,
        )
    missing = [
        token
        for token in (INPUT_TOKEN, OUTPUT_TOKEN)
        if not any(token in part for part in tokens)
    ]
    if missing:
        raise ConversionError(
            "PARASOLID_CONVERTER_MISCONFIGURED",
            (
                "The Parasolid converter command is missing the "
                f"{' and '.join(missing)} placeholder(s). Example: "
                "'cadex_convert -i {input} -o {output}'."
            ),
            status_code=500,
        )
    return [
        part.replace(INPUT_TOKEN, input_path).replace(OUTPUT_TOKEN, output_path)
        for part in tokens
    ]


def _stderr_tail(raw: Optional[bytes]) -> str:
    if not raw:
        return ""
    text = raw.decode("utf-8", errors="replace").strip()
    return text[-_STDERR_TAIL_CHARS:]


def to_step(
    source_path: str, config: MachiningConfig, source_format: str = "PARASOLID"
) -> ConversionResult:
    """Convert ``source_path`` to STEP with the configured external converter.

    The caller owns the returned :class:`ConversionResult` and must call
    ``cleanup()`` once the shape has been read. Nothing is written next to the
    source file; the output goes to a fresh scratch directory so a converter
    that emits extra sidecar files cannot litter the temp root.
    """
    template = converter_command(config)
    if not template:
        raise ConversionError(
            "PARASOLID_CONVERTER_UNAVAILABLE",
            (
                "Parasolid import requires an external converter, which is not "
                "configured on this deployment. Set "
                "MACHINING_PARASOLID_CONVERTER_CMD, or export the part as STEP "
                "(AP214/AP242) and upload that instead."
            ),
            status_code=415,
        )

    workdir = tempfile.mkdtemp(prefix="parasolid-")
    output_path = os.path.join(workdir, "converted.step")
    argv = build_command(template, source_path, output_path)

    logger.info("converting %s to STEP via %s", source_format, argv[0])
    timeout = config.parasolid_converter_timeout_s
    started = time.monotonic()
    try:
        completed = subprocess.run(  # noqa: S603 - argv list, shell=False, no user-built tokens
            argv,
            shell=False,
            capture_output=True,
            timeout=timeout,
            check=False,
        )
    except subprocess.TimeoutExpired:
        shutil.rmtree(workdir, ignore_errors=True)
        raise ConversionError(
            "CONVERSION_TIMEOUT",
            (
                f"The Parasolid converter did not finish within {timeout:g}s. "
                "Raise MACHINING_PARASOLID_CONVERTER_TIMEOUT_S for very large "
                "models, or convert the part to STEP offline."
            ),
            status_code=504,
        )
    except (FileNotFoundError, NotADirectoryError, PermissionError) as exc:
        shutil.rmtree(workdir, ignore_errors=True)
        raise ConversionError(
            "PARASOLID_CONVERTER_UNAVAILABLE",
            (
                f"The configured Parasolid converter '{argv[0]}' could not be "
                f"executed ({type(exc).__name__}). Check "
                "MACHINING_PARASOLID_CONVERTER_CMD and that the binary is "
                "present in the service image."
            ),
            status_code=503,
        )
    except OSError as exc:  # pragma: no cover - platform dependent
        shutil.rmtree(workdir, ignore_errors=True)
        raise ConversionError(
            "CONVERSION_FAILED",
            f"The Parasolid converter could not be started: {exc}",
            status_code=500,
        )

    if completed.returncode != 0:
        detail = _stderr_tail(completed.stderr) or _stderr_tail(completed.stdout)
        shutil.rmtree(workdir, ignore_errors=True)
        raise ConversionError(
            "CONVERSION_FAILED",
            (
                f"The Parasolid converter exited with code "
                f"{completed.returncode}. The file may be corrupt or use a "
                "Parasolid schema the converter does not support."
                + (f" Converter output: {detail}" if detail else "")
            ),
            status_code=422,
        )

    if not os.path.exists(output_path) or os.path.getsize(output_path) == 0:
        shutil.rmtree(workdir, ignore_errors=True)
        raise ConversionError(
            "CONVERSION_FAILED",
            (
                "The Parasolid converter reported success but produced no STEP "
                "output. Check that the command writes to the {output} path it "
                "is given."
            ),
            status_code=422,
        )

    duration_ms = int((time.monotonic() - started) * 1000)
    logger.info("%s -> STEP conversion succeeded in %dms", source_format, duration_ms)
    return ConversionResult(
        path=output_path,
        workdir=workdir,
        command=argv,
        duration_ms=duration_ms,
        source_format=source_format,
    )
