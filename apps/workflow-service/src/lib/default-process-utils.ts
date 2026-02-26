// Helper: Check if process is sheet metal-based
export function isSheetMetalProcess(process: string | undefined): boolean {
  if (!process) return false;
  // Clean up any malformed process strings (e.g., "\"sheet-metal\"" -> "sheet-metal")
  const cleanProcess = process
    .replaceAll(/(?:^["'\s]+)|(?:["'\s]+$)/g, "")
    .replaceAll(String.raw`\"`, "")
    .toLowerCase();
  return (
    cleanProcess === "sheet-metal" ||
    cleanProcess.includes("sheet") ||
    cleanProcess === "laser" ||
    cleanProcess === "drilling" ||
    cleanProcess === "plasma" ||
    cleanProcess === "waterjet"
  );
}

// Get default material for a process
export function getDefaultMaterialForProcess(process: string): string {
  if (isSheetMetalProcess(process)) {
    // Default to Aluminum 5052 - 2.0mm for sheet metal
    return "AL5052-2.0";
  }
  // Default to Aluminum 6061 for CNC
  return "aluminum-6061";
}

// Get default finish for a process
export function getDefaultFinishForProcess(process: string): string {
  if (isSheetMetalProcess(process)) {
    return "as-cut";
  }
  return "as-machined";
}

// Get default tolerance for a process (CNC only)
export function getDefaultToleranceForProcess(process: string): string {
  return "standard";
}

// Get default thickness for sheet metal
export function getDefaultThickness(): string {
  return "2.0"; // 2.0mm default
}
