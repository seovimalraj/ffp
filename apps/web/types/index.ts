export type IRFQStatuses =
  | "draft"
  | "pending"
  | "quoted"
  | "accepted"
  | "rejected";

export type ICategory = {
  id: string;
  name: string;
  code: string;
  description: string;
  createdAt: Date;
  updatedAt: Date;
};

export type IMaterial = {
  id: string;
  name: string;
  code: string;
  description: string;
  material_categories: ICategory;
  base_price: number;
  stock_material: "block" | "bar" | "plate";
  unit: string;
  currency: string;
  status: "active" | "inactive";
  created_at: Date;
  updated_at: Date;
};

export type IGroupedMaterial = {
  id: string;
  code: string;
  name: string;
  description: string;
  material_categories: ICategory;
  currency: string;
  unit: string;
  status: "active" | "inactive";
  updated_at: Date;
  stock_prices: {
    block?: { id: string; price: number };
    bar?: { id: string; price: number };
    plate?: { id: string; price: number };
  };
};

export type IGroupWarehouses = {
  id: string;
  name: string;
  total_capacity: number;
  used_capacity: number;
  unit: string;
  address: string;
};

export type IGroupRFQs = {
  rfq_code: string;
  final_price: number | null;
  status: IRFQStatuses;
  parts_count: number;
  created_at: Date;
  updated_at: Date;
};

export type IGroupTolerance = {
  id: string;
  name: string;
  description: string;
  range_value: number;
  percentage: number;
};
