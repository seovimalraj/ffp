/**
 * Shared CAD file validation constants.
 *
 * Both the client (dfm-analysis page) and the server (upload/cad route)
 * import from here so the accepted list is maintained in one place.
 */

/** MIME types accepted for CAD file uploads. */
export const ALLOWED_MIME_TYPES = [
  "application/step",
  "application/x-step",
  "application/iges",
  "application/x-iges",
  "application/sldprt",
  "application/sla",
  "application/vnd.ms-pki.stl",
  "model/stl",
  "model/x.stl",
  "model/x-t",
  "model/x-b",
  "application/x-jt",
  "model/3mf",
  "image/vnd.dxf",
  "application/zip",
  "application/x-zip-compressed",
  "application/octet-stream",
] as const;

/** Accepted file extensions (without leading dot). */
export const ALLOWED_EXTENSIONS = [
  "step",
  "stp",
  "iges",
  "igs",
  "sldprt",
  "x_t",
  "x_b",
  "jt",
  "3mf",
  "dxf",
  "stl",
  "zip",
] as const;

/** Accepted file extensions with leading dot — used by the client `<input accept>`. */
export const ACCEPTED_FILE_EXTENSIONS = ALLOWED_EXTENSIONS.map(
  (ext) => `.${ext}`,
);

/** Combined accept string for client `<input accept>`. */
export const ACCEPTED_FILE_TYPES = [
  ...ALLOWED_MIME_TYPES,
  ...ACCEPTED_FILE_EXTENSIONS,
];
