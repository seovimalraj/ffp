import { SupabaseService } from 'src/supabase/supabase.service';
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { CurrencyType, Tables } from '../../libs/constants';

@Injectable()
export class WarehouseService {
  constructor(private readonly supabaseService: SupabaseService) {}

  async getWarehouseById(warehouseId: string, organizationId: string) {
    const client = this.supabaseService.getClient();

    try {
      // 1. Fetch warehouse (required)
      const { data: warehouse, error: warehouseError } = await client
        .from(Tables.Warehouses)
        .select('*')
        .eq('id', warehouseId)
        .eq('organization_id', organizationId)
        .single();

      if (warehouseError || !warehouse) {
        throw new NotFoundException('Warehouse not found');
      }

      // 2. Fetch materials inside the warehouse (can be zero or more)
      const { data: supplierMaterials, error: materialsError } = await client
        .from(Tables.SupplierMaterials)
        .select(
          `
          id,
          supplier_price,
          currency,
          current_stock,
          max_stock,
          status,
          material (
            id,
            name
          )
        `,
        )
        .eq('warehouse_id', warehouseId);

      if (materialsError) {
        throw new InternalServerErrorException(
          'Failed to fetch materials' + JSON.stringify(materialsError),
        );
      }

      // 3. Return a consolidated response
      return {
        warehouse,
        materials: supplierMaterials ?? [],
      };
    } catch (error) {
      console.error('getWarehouseById error:', error);
      throw new InternalServerErrorException('Failed to fetch warehouse by ID');
    }
  }

  async createStockForWarehouse(
    organizationId: string,
    materialId: string,
    warehouseId: string,
    quantity: number,
    unit: string,
    price: number,
    currency: CurrencyType,
    maxStock: number,
  ) {
    const client = this.supabaseService.getClient();

    try {
      const { data, error } = await client.rpc('create_stock_for_warehouse', {
        p_org_id: organizationId,
        p_material_id: materialId,
        p_warehouse_id: warehouseId,
        p_quantity: quantity,
        p_unit: unit,
        p_price: price,
        p_currency: currency,
        p_max_stock: maxStock,
      });

      if (error) {
        if (error.message.includes('Warehouse not found')) {
          throw new NotFoundException('Warehouse not found');
        }

        if (error.message.includes('Not enough warehouse capacity')) {
          throw new BadRequestException('Not enough warehouse capacity');
        }

        console.error('Unexpected DB error:', error);
        throw new InternalServerErrorException(
          'Failed to create warehouse stock',
        );
      }

      return data;
    } catch (err) {
      console.error('Transaction failed:', err);
      throw err;
    }
  }

  async addStockToWarehouse(
    organizationId: string,
    supplierMaterialId: string,
    warehouseId: string,
    quantity: number,
  ) {
    const client = this.supabaseService.getClient();

    try {
      const { data, error } = await client.rpc('add_stock_to_warehouse', {
        p_supplier_material_id: supplierMaterialId,
        p_warehouse_id: warehouseId,
        p_org_id: organizationId,
        p_quantity: quantity,
      });

      if (error) {
        // Map DB errors to meaningful API errors
        if (error.message.includes('Supplier material not found')) {
          throw new NotFoundException('Supplier material not found');
        }

        if (error.message.includes('Warehouse not found')) {
          throw new NotFoundException('Warehouse not found');
        }

        if (error.message.includes('Exceeds max stock')) {
          throw new BadRequestException('Exceeds max stock');
        }

        if (error.message.includes('Not enough warehouse capacity')) {
          throw new BadRequestException('Not enough warehouse capacity');
        }

        // unknown DB error → internal error
        console.error('Unexpected DB error:', error);
        throw new InternalServerErrorException('Failed to update inventory');
      }

      return { data, success: true };
    } catch (err) {
      console.error('Operation failed:', err);
      throw err;
    }
  }

  async removeStockFromWarehouse(
    organizationId: string,
    materialId: string,
    warehouseId: string,
    quantity: number,
  ) {
    const client = this.supabaseService.getClient();

    try {
      const { data, error } = await client.rpc('remove_stock_from_warehouse', {
        p_org_id: organizationId,
        p_material_id: materialId,
        p_warehouse_id: warehouseId,
        p_quantity: quantity,
      });

      if (error) {
        if (error.message.includes('Stock entry not found')) {
          throw new NotFoundException('Stock entry not found');
        }

        if (error.message.includes('Insufficient stock quantity')) {
          throw new BadRequestException('Insufficient stock quantity');
        }

        if (error.message.includes('Warehouse not found')) {
          throw new NotFoundException('Warehouse not found');
        }

        console.error('Unexpected remove stock error:', error);
        throw new InternalServerErrorException(
          'Failed to remove stock from warehouse',
        );
      }

      return data;
    } catch (err) {
      console.error('Remove stock transaction failed:', err);
      throw err;
    }
  }
}
