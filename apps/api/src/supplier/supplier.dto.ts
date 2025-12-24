import { CurrencyType, StockMaterial, UnitType } from '../../libs/constants';

export type CreateWarehouseDto = {
  name: string;
  organzationId: string;
  total_capacity: number;
  used_capacity: number;
  geolocation?: string;
  address: string;
  unit: UnitType;
};

export type AddStockDto = {
  materialId: string;
  quantity: number;
  unit: string;
  stockType: StockMaterial;
  price: number;
  max_stock: number;
  currency: CurrencyType;
};

export type UpdateStockDto = {
  supplierMaterialId: string;
  quantity: number;
};

export type RemoveStockDto = {
  materialId: string;
  quantity: number;
};

export type CreateSupplierMaterialDto = {
  material: string;
  warehouse: string;
  current_stock: number;
  max_stock: number;
  stock_unit: UnitType;
  supplier_price: number;
  status: 'active' | 'inactive';
  currency: CurrencyType;
};
