export type InitialPartDto = {
  file_name: string;
  cad_file_url: string;
  cad_file_type: string;
  material: string;
  quantity: number;
  tolerance: string;
  finish: string;
  threads: string;
  inspection: string;
  notes: string;
  lead_time_type: string;
  lead_time: number;
  geometry: any;
  certificates: string[];
  is_archived: boolean;
};

export type InitialRFQDto = {
  user_id: string;
  parts: InitialPartDto[];
};

export type RemovePartsDto = {
  partIds: string[];
};

export type PartPricingUpdateDto = {
  id: string;
  final_price: number;
  lead_time: number;
};

export type SyncPricingDto = {
  rfq_final_price: number;
  parts: PartPricingUpdateDto[];
};

// InitialPartDto + final_price can be updated
export type UpdatePartDto = Partial<InitialPartDto> & {
  final_price?: number;
  is_archived?: boolean;
  rfq_final_price?: number;
};

export type Add2DDrawingsDto = {
  file_name: string;
  file_url: string;
  mime_type: string;
};

export type Drawing2DLookupDto = {
  part_id: string;
  rfq_id: string;
  file_name: string;
  file_url: string;
  mime_type: string;
};

export type UpdateRfqDto = {
  final_price?: number;
  status?: string;
};
