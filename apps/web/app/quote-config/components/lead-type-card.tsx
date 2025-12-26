import { formatCurrencyFixed } from "@/lib/utils";
import { PartConfig } from "@/types/part-config";
import { leadTimeMeta, markupMap } from "@cnc-quote/shared";

type LeadTypeCardProps = {
  leadTimeType: "economy" | "standard" | "expedited";
  part: PartConfig;
  index: number;
  updatePart: (
    index: number,
    key: string,
    value: any,
    isArchived?: boolean,
  ) => void;
  calculatePrice: (
    part: PartConfig,
    leadTimeType: "economy" | "standard" | "expedited",
  ) => number;
  calculateLeadTime: (
    part: PartConfig,
    leadTimeType: "economy" | "standard" | "expedited",
  ) => number;
};

const LeadTypeCard = ({
  leadTimeType,
  part,
  index,
  updatePart,
  calculatePrice,
  calculateLeadTime,
}: LeadTypeCardProps) => {
  const realPrice = calculatePrice(part, leadTimeType) / part.quantity;

  const uplift = markupMap[leadTimeType];
  const marketingPrice = realPrice * (1 + uplift);

  const isSelected = part.leadTimeType === leadTimeType;
  const icon = `/icons/${leadTimeType}.png`;
  const leadTime = calculateLeadTime(part, leadTimeType);

  return (
    <div
      key={leadTimeType}
      onClick={() => updatePart(index, "leadTimeType", leadTimeType, false)}
      className={`
        relative cursor-pointer rounded-2xl border p-4 transition-all
        ${
          isSelected
            ? "border-blue-600 bg-blue-50 ring-2 ring-blue-600"
            : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm"
        }
      `}
    >
      {/* Badge */}
      <div className="absolute -right-3 -top-2">
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${isSelected ? "bg-blue-100 text-blue-700" : "bg-slate-200 text-slate-600"}`}
        >
          {leadTimeMeta[leadTimeType].badge}
        </span>
      </div>

      {/* Header */}
      <div className="mb-4 flex items-center gap-3">
        <img src={icon} alt="" className="h-9 w-9 shrink-0" />

        <div className="leading-tight">
          <div className="text-sm font-semibold capitalize text-slate-700">
            {leadTimeType}
          </div>
          <div className="text-xs text-slate-400">{leadTime} Business Days</div>
        </div>
      </div>

      {/* Pricing */}
      <div className="space-y-1">
        <div className="flex items-end justify-between">
          <div className="text-sm text-slate-400 line-through">
            {formatCurrencyFixed(marketingPrice)}
          </div>

          <div
            className={`text-2xl font-bold leading-none ${
              isSelected ? "text-blue-700" : "text-slate-700"
            }`}
          >
            {formatCurrencyFixed(realPrice)}
          </div>
        </div>

        <div className="text-xs text-slate-500">
          You save{" "}
          <span className="font-semibold text-green-700">
            {formatCurrencyFixed(marketingPrice - realPrice)}
          </span>
        </div>
      </div>

      {/* Selected indicator */}
      {isSelected && (
        <div className="absolute bottom-3 right-3 text-[11px] font-semibold text-blue-700">
          Selected
        </div>
      )}
    </div>
  );
};

export default LeadTypeCard;
