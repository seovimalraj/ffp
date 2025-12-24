import { PartialType } from '@nestjs/mapped-types';
import { IsEnum, IsNumber, IsObject, IsString } from 'class-validator';
import { StockMaterial } from '../../libs/constants';

export class CreateMaterialDto {
  @IsString()
  name: string;

  @IsString()
  code: string;

  @IsString()
  category: string;

  @IsObject()
  stock_prices: {
    block: number;
    bar: number;
    plate: number;
  };

  @IsString()
  unit: string;

  @IsString()
  description: string;

  @IsEnum(['active', 'inactive'])
  status: 'active' | 'inactive';

  @IsEnum(['USD', 'EUR', 'INR'])
  currency: 'USD' | 'EUR' | 'INR';
}

export class CreateSupplierMaterialDto {
  @IsString()
  material: string;

  @IsNumber()
  stock_quantity: string;

  @IsEnum(['USD', 'EUR', 'INR'])
  currency: 'USD' | 'EUR' | 'INR';

  @IsString()
  stock_unit: string;

  @IsNumber()
  supplier_price: number;

  @IsEnum(StockMaterial)
  stock_material: StockMaterial;

  @IsEnum(['active', 'inactive'])
  status: 'active' | 'inactive';
}

export class UpdateMaterialDto extends PartialType(CreateMaterialDto) {}

export class CreateCategoryDto {
  @IsString()
  name: string;

  @IsString()
  slug: string;

  @IsString()
  description: string;
}
