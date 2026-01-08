import { GeometryData } from "@/lib/cad-analysis";
import { PricingBreakdown } from "@/lib/pricing-engine";

export interface File2D {
  id?: string;
  file: File | { name: string; type: string; size: number; id: string };
  preview: string;
}

export interface PartConfig {
  id: string;
  rfqId: string;
  status: "active" | "draft";
  fileName: string;
  filePath: string;
  fileObject?: File;
  material: string;
  quantity: number;
  tolerance: string;
  finish: string;
  threads: string;
  inspection: string;
  notes: string;
  leadTimeType: "economy" | "standard" | "expedited";
  geometry?: GeometryData;
  pricing?: PricingBreakdown;
  files2d?: File2D[];
  certificates?: string[];
  final_price?: number;
  leadTime?: number;
  snapshot_2d_url?: string;
  is_archived?: boolean;
}

export type MaterialItem = {
  value: string;
  label: string;
  multiplier: number;
  icon: string;
};

export type ToleranceItem = {
  value: string;
  label: string;
};

export type FinishItem = {
  value: string;
  label: string;
  cost: number;
};

export type InspectionItem = {
  value: string;
  label: string;
};

export type ThreadItem = {
  value: string;
  label: string;
};
