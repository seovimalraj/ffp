import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { RoleNames, Tables } from '../../libs/constants';
import { AuthGuard } from 'src/auth/auth.guard';
import { Roles } from 'src/auth/roles.decorator';
import { SupabaseService } from 'src/supabase/supabase.service';
import {
  CreateCategoryDto,
  CreateMaterialDto,
  CreateSupplierMaterialDto,
} from './materials.dto';
import { CurrentUser } from 'src/auth/user.decorator';
import { CurrentUserDto } from 'src/auth/auth.dto';

@Controller('materials')
@UseGuards(AuthGuard)
export class MaterialsController {
  constructor(private readonly supbaseService: SupabaseService) {}

  @Get('')
  @Roles(RoleNames.Admin, RoleNames.Supplier, RoleNames.Customer)
  async getMaterials() {
    const client = this.supbaseService.getClient();

    const { data, error } = await client.from(Tables.GeneralMaterialsTable)
      .select(`
                *,
                material_categories ( id, name )
            `);

    if (error) {
      console.error('Get materials error:', error);
      throw new InternalServerErrorException('Failed to fetch materials');
    }

    // Group materials by code
    const grouped = new Map<string, any>();

    (data ?? []).forEach((material) => {
      const existing = grouped.get(material.code);

      if (existing) {
        // Add stock price to existing group
        if (material.stock_material) {
          existing.stock_prices[material.stock_material] = {
            id: material.id,
            price: material.base_price,
          };
        }
        // Use latest updated_at
        if (new Date(material.updated_at) > new Date(existing.updated_at)) {
          existing.updated_at = material.updated_at;
        }
      } else {
        // Create new group
        const newGroup = {
          code: material.code,
          name: material.name,
          description: material.description,
          material_categories: material.material_categories,
          currency: material.currency,
          unit: material.unit,
          status: material.status,
          updated_at: material.updated_at,
          stock_prices: {} as Record<string, { id: string; price: number }>,
        };
        if (material.stock_material) {
          newGroup.stock_prices[material.stock_material] = {
            id: material.id,
            price: material.base_price,
          };
        }
        grouped.set(material.code, newGroup);
      }
    });

    return {
      materials: Array.from(grouped.values()),
    };
  }

  @Get('minimal')
  @Roles(RoleNames.Admin, RoleNames.Supplier, RoleNames.Customer)
  async getMinimalMaterials() {
    const client = this.supbaseService.getClient();

    const { data, error } = await client.from(Tables.MaterialTable).select(`
                name, id
            `);

    if (error) {
      console.error('Get materials error:', error);
      throw new InternalServerErrorException('Failed to fetch materials');
    }

    return {
      materials: data ?? [],
    };
  }

  @Get('category')
  @Roles(RoleNames.Admin, RoleNames.Supplier, RoleNames.Customer)
  async getMaterialCategories(): Promise<{
    categories: { id: string; name: string }[];
  }> {
    const client = this.supbaseService.getClient();

    const { data, error } = await client
      .from(Tables.MaterialCategories)
      .select('id, name, slug, description');

    if (error) {
      console.error('Get categories error:', error);
      throw new InternalServerErrorException('Failed to fetch categories');
    }

    return { categories: data ?? [] };
  }

  @Post('category')
  @Roles(RoleNames.Admin)
  async createCategory(@Body() body: CreateCategoryDto) {
    const client = this.supbaseService.getClient();

    const { data, error } = await client
      .from(Tables.MaterialCategories)
      .insert({
        name: body.name,
        slug: body.slug,
        description: body.description,
      })
      .select()
      .single();

    if (error) {
      console.error('Create category error:', error);
      if (error.code === '23505') {
        throw new BadRequestException(
          'A category with this name or slug already exists',
        );
      }
      throw new InternalServerErrorException('Failed to create category');
    }

    return { category: data };
  }

  @Get('supplier/:id')
  @Roles(RoleNames.Admin, RoleNames.Supplier)
  async getSupplierMaterials(@Param() params: { id: string }) {
    const client = this.supbaseService.getClient();

    const { data, error } = await client
      .from(Tables.SupplierMaterials)
      .select(`*`)
      .eq('supplier_id', params.id);

    if (error) {
      console.error('Get supplier materials error:', error);
      throw new InternalServerErrorException(
        'Failed to fetch supplier materials',
      );
    }

    return { materials: data ?? [] };
  }

  @Post('supplier/:id')
  @Roles(RoleNames.Admin, RoleNames.Supplier)
  async createSupplierMaterial(
    @CurrentUser() currentUser: CurrentUserDto,
    @Body() body: CreateSupplierMaterialDto,
  ) {
    const client = this.supbaseService.getClient();

    const { data, error } = await client
      .from(Tables.SupplierMaterials)
      .insert({
        supplier_id: currentUser.id,
        material: body.material,
        stock_quantity: body.stock_quantity,
        currency: body.currency,
        stock_unit: body.stock_unit,
        supplier_price: body.supplier_price,
        stock_material: body.stock_material,
        status: body.status,
      })
      .select()
      .single();

    if (error) {
      console.error('Create supplier material error:', error);
      if (error.code === '23505') {
        throw new BadRequestException(
          'This material already exists for this supplier',
        );
      }
      throw new InternalServerErrorException(
        'Failed to create supplier material',
      );
    }

    return { material: data };
  }
  @Post('')
  @Roles(RoleNames.Admin)
  async createMaterial(@Body() body: CreateMaterialDto) {
    const client = this.supbaseService.getClient();

    // Expand stock-price pairs into individual rows
    const materialsToInsert = Object.entries(body.stock_prices).map(
      ([stock, price]) => ({
        name: body.name,
        code: body.code,
        category_id: body.category,
        stock_material: stock,
        base_price: price,
        description: body.description,
        status: body.status,
        currency: body.currency,
        unit: body.unit,
      }),
    );

    // Insert into general_materials
    const { data: generalInsert, error: generalError } = await client
      .from(Tables.GeneralMaterialsTable)
      .insert(materialsToInsert)
      .select();

    if (generalError) {
      console.error('General material insert error:', generalError);

      if (generalError.code === '23505') {
        throw new BadRequestException(
          'A material with this code already exists',
        );
      }

      throw new InternalServerErrorException(
        'Failed to create material entries',
      );
    }

    // Insert into materials table (the parent)
    const { data: materialInsert, error: materialError } = await client
      .from(Tables.MaterialTable)
      .insert({ name: body.name })
      .select();

    if (materialError) {
      console.error('Material table insert error:', materialError);

      if (materialError.code === '23505') {
        throw new BadRequestException(
          'A material with this name already exists',
        );
      }

      throw new InternalServerErrorException('Failed to create material');
    }

    return {
      material: materialInsert?.[0] ?? null,
      general_materials: generalInsert ?? [],
    };
  }
}
