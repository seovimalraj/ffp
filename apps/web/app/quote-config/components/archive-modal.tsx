import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { FinishItem, MaterialItem, PartConfig } from "@/types/part-config";
import { Archive, Package } from "lucide-react";

type ArchiveModalProps = {
  showArchiveModal: boolean;
  setShowArchiveModal: (show: boolean) => void;
  archivedParts: PartConfig[];
  MATERIALS_LIST: MaterialItem[];
  FINISHES_LIST: FinishItem[];
  handleUnarchivePart: (partId: string) => void;
  handleUnarchiveAll: () => void;
};

const ArchiveModal = ({
  showArchiveModal,
  setShowArchiveModal,
  archivedParts,
  MATERIALS_LIST,
  FINISHES_LIST,
  handleUnarchivePart,
  handleUnarchiveAll,
}: ArchiveModalProps) => {
  return (
    <Dialog open={showArchiveModal} onOpenChange={setShowArchiveModal}>
      <DialogContent
        showClose={true}
        className="sm:max-w-4xl max-h-[85vh] overflow-hidden flex flex-col"
      >
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold flex items-center gap-2">
            <Archive className="w-6 h-6 text-slate-600" />
            Archived Parts
          </DialogTitle>
          <DialogDescription>
            View and restore archived parts. Archived parts are not included in
            your quote.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto pr-2 -mr-2 custom-scrollbar">
          {archivedParts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-20 h-20 rounded-full bg-slate-100 flex items-center justify-center mb-4">
                <Archive className="w-10 h-10 text-slate-400" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900 mb-2">
                No Archived Parts
              </h3>
              <p className="text-sm text-slate-500 max-w-sm">
                Parts you archive will appear here. You can restore them at any
                time.
              </p>
            </div>
          ) : (
            <div className="space-y-4 w-full">
              {archivedParts.map((part, index) => (
                <div
                  key={part.id}
                  className="border border-slate-200 rounded-lg p-4 bg-white hover:shadow-md transition-all"
                >
                  <div className="flex items-start gap-4">
                    {/* Part Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-slate-100 text-slate-500 text-xs font-bold flex-shrink-0">
                          {index + 1}
                        </span>
                        <h4 className="text-base font-bold text-slate-900 truncate">
                          {part.fileName}
                        </h4>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
                        <div>
                          <p className="text-xs font-semibold text-slate-500 uppercase tracking-tight mb-1">
                            Material
                          </p>
                          <p className="text-sm font-medium text-slate-900">
                            {
                              MATERIALS_LIST.find(
                                (m) => m.value === part.material,
                              )?.label
                            }
                          </p>
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-slate-500 uppercase tracking-tight mb-1">
                            Quantity
                          </p>
                          <p className="text-sm font-medium text-slate-900">
                            {part.quantity} pcs
                          </p>
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-slate-500 uppercase tracking-tight mb-1">
                            Finish
                          </p>
                          <p className="text-sm font-medium text-slate-900">
                            {
                              FINISHES_LIST.find((f) => f.value === part.finish)
                                ?.label
                            }
                          </p>
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-slate-500 uppercase tracking-tight mb-1">
                            Lead Time
                          </p>
                          <p className="text-sm font-medium text-slate-900 capitalize">
                            {part.leadTimeType}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col gap-2">
                      <Button
                        size="sm"
                        onClick={() => handleUnarchivePart(part.id)}
                        className="bg-blue-600 hover:bg-blue-700 text-white whitespace-nowrap"
                      >
                        <Package className="w-4 h-4 mr-2" />
                        Restore
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="flex justify-end mt-7">
            {archivedParts.length > 0 && (
              <Button
                onClick={handleUnarchiveAll}
                className="bg-blue-600 ml-auto w-full max-w-xs hover:bg-blue-700 text-white"
              >
                <Package className="w-4 h-4 mr-2" />
                Restore All
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ArchiveModal;
