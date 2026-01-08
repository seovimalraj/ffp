import { ReactNode } from "react";
import { cn } from "@/lib/utils";

/* =========================
   Root
========================= */

type FolderCardProps = {
  accentColor?: string;
  className?: string;
  children: ReactNode;
  isSelected?: boolean;
  onSelect?: (selected: boolean) => void;
};

export function FolderCard({
  accentColor = "#7036E9",
  className = "",
  children,
  isSelected,
  onSelect,
}: FolderCardProps) {
  return (
    <div
      className={cn(
        "group relative mx-auto w-[420px] h-[310px] rounded-[5px_25px_25px_25px] bg-white drop-shadow-[0_0_0.5rem_rgba(0,0,0,0.25)] transition-all",
        isSelected && "ring-2 ring-primary ring-offset-2 scale-[1.02]",
        className,
      )}
    >
      {/* Selection Checkbox */}
      <div
        className={cn(
          "absolute -top-1 right-2 z-10 transition-opacity duration-200",
          isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100",
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <input
          type="checkbox"
          checked={isSelected}
          onChange={(e) => onSelect?.(e.target.checked)}
          className="w-5 h-5 rounded-md border-slate-300 text-primary focus:ring-primary cursor-pointer"
        />
      </div>
      {/* Folder top shape */}
      <div
        className="
          absolute -top-[18px] left-0
          h-[25px] w-[200px]
          rounded-tl-[25px]
          bg-white
          [clip-path:path('M_0_0_L_160_0_C_185_2,_175_16,_200_18_L_0_50_z')]
        "
      />

      {/* Accent tab */}
      <div
        className="absolute -top-[18px] left-[40px] h-[5px] w-[85px] rounded-b-md"
        style={{ backgroundColor: accentColor }}
      />

      <div className="flex h-full flex-col overflow-hidden pt-6">
        {children}
      </div>
    </div>
  );
}

/* =========================
   Header
========================= */

type HeaderProps = {
  children: ReactNode;
};

FolderCard.Header = function Header({ children }: HeaderProps) {
  return (
    <div className="border-b border-slate-200 px-6 py-3">
      <div className="flex items-center justify-between gap-3">{children}</div>
    </div>
  );
};

/* =========================
   Meta (optional)
========================= */

type MetaProps = {
  children: ReactNode;
};

FolderCard.Meta = function Meta({ children }: MetaProps) {
  return <div className="px-6 py-2 text-xs text-slate-500">{children}</div>;
};

/* =========================
   Body
========================= */

type BodyProps = {
  children: ReactNode;
};

FolderCard.Body = function Body({ children }: BodyProps) {
  return (
    <div className="flex-1 overflow-auto invisible-scrollbar px-6 py-4 text-sm text-slate-700">
      {children}
    </div>
  );
};

/* =========================
   Footer
========================= */

type FooterProps = {
  children: ReactNode;
};

FolderCard.Footer = function Footer({ children }: FooterProps) {
  return (
    <div className="border-t border-slate-200 px-6 py-3">
      <div className="flex items-center justify-end gap-2">{children}</div>
    </div>
  );
};
