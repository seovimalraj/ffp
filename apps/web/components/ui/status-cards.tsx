type StatusItem = {
  label: string;
  value: string | number;
  subValue?: string;
};

type StatusCardsProps = {
  items: StatusItem[];
};

export function StatusCards({ items }: StatusCardsProps) {
  return (
    <div className="grid w-full grid-cols-1 gap-1 sm:grid-cols-2 lg:grid-cols-4">
      {items.map((item, index) => (
        <div
          key={index}
          className="relative w-full h-full flex flex-col animate-scale-in rounded"
          style={{
            background: "rgba(255, 255, 255, 0.05)",
            backdropFilter: "blur(24px) saturate(200%)",
            WebkitBackdropFilter: "blur(24px) saturate(200%)",
            border: "1px solid rgba(255, 255, 255, 0.4)",
            boxShadow:
              "0 8px 32px rgba(31, 38, 135, 0.15), inset 0 4px 30px rgba(255, 255, 255, 0.25)",
		padding: "10px"
          }}
        >
          {/* Liquid Glass Shine Effect */}
          <div
            className="
              pointer-events-none absolute inset-0
              bg-gradient-to-br from-white/40 via-transparent to-transparent
              opacity-60 transition-opacity group-hover:opacity-80
            "
          />

          {/* Sub-border for glass depth */}
          <div className="absolute inset-[1px] rounded-[inherit] border border-white/20 pointer-events-none" />

          <div className="relative">
            {/* Label */}
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500/70">
              {item.label}
            </span>

            {/* Value */}
            <div className="mt-1.5 flex items-baseline gap-2">
              <span className="text-2xl font-bold tracking-tight text-slate-900">
                {item.value}
              </span>
            </div>

            {/* Optional sub value */}
            {item.subValue && (
              <span className="mt-1 block text-xs font-medium text-slate-400">
                {item.subValue}
              </span>
            )}
          </div>

          {/* Subtle liquid edge at the bottom */}
          <div className="absolute bottom-0 left-4 right-4 h-[1px] bg-gradient-to-r from-transparent via-slate-200/50 to-transparent" />
        </div>
      ))}
    </div>
  );
}
