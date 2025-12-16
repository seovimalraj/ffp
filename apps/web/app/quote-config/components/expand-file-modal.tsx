import { CadViewer } from "@/components/cad/cad-viewer";

type ExpandFileModalProps = {
  expandedFile: File | string | null;
  setExpandedFile: (file: File | string | null) => void;
};

const ExpandFileModal = ({
  expandedFile,
  setExpandedFile,
}: ExpandFileModalProps) => {
  const fileName =
    expandedFile instanceof File
      ? expandedFile.name
      : typeof expandedFile === "string"
        ? expandedFile.split("/").pop()
        : "";

  return (
    <div className="animate-fade-in fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
      <div className="animate-scale-in relative h-[90vh] w-[90vw] overflow-hidden rounded-2xl bg-[#0b1220] shadow-2xl">
        {/* Modal Header */}
        <div className="absolute left-0 right-0 top-0 z-10 flex items-center justify-between bg-gradient-to-b from-black/50 to-transparent p-4">
          <h2 className="text-lg font-medium text-white drop-shadow-md">
            {fileName}
          </h2>
          <button
            onClick={() => setExpandedFile(null)}
            className="rounded-full bg-white/10 p-2 text-white backdrop-blur-md transition-colors hover:bg-white/20"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Fullscreen Viewer */}
        <CadViewer
          file={expandedFile}
          className="h-full w-full"
          showControls={true}
        />
      </div>
    </div>
  );
};

export default ExpandFileModal;
