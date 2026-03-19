import { Type } from 'class-transformer';
import {
  IsString,
  IsNotEmpty,
  IsUUID,
  IsInt,
  IsPositive,
  IsNumber,
  IsArray,
  ValidateNested,
  IsOptional,
  IsObject,
  IsBoolean,
} from 'class-validator';

export class CreateShippingAddressDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  street1: string;

  @IsString()
  street2: string;

  @IsString()
  @IsNotEmpty()
  city: string;

  @IsString()
  @IsNotEmpty()
  zip: string;

  @IsString()
  @IsNotEmpty()
  country: string;

  @IsString()
  @IsNotEmpty()
  phone: string;

  @IsString()
  @IsNotEmpty()
  email: string;
}

export class CreateOrderPartDto {
  @IsUUID()
  rfq_part_id: string;

  @IsString()
  part_name: string;

  @IsInt()
  @IsPositive()
  quantity: number;

  @IsNumber()
  @IsPositive()
  unit_price: number;

  @IsInt()
  @IsPositive()
  lead_time: number;

  @IsString()
  lead_time_type: string;
}

export class CreateOrderDto {
  @IsUUID()
  rfqId: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateOrderPartDto)
  parts: CreateOrderPartDto[];

  @IsNumber()
  subtotal: number;

  @IsNumber()
  shippingCost: number;

  @IsNumber()
  taxAmount: number;

  @IsOptional()
  @IsObject()
  customsInfo?: Record<string, any>;

  @IsOptional()
  @IsString()
  internalNotes?: string;

  @IsOptional()
  @IsObject()
  shippingInformation?: Record<string, any>;

  @IsOptional()
  @IsString()
  shippingMethod?: string;

  @IsOptional()
  @IsObject()
  addressSnapshot?: Record<string, any>;
}

export class PayOrderDto {
  @IsNumber()
  amount: number;

  @IsString()
  currency: string;

  @IsString()
  paymentMethod: string;

  @IsString()
  @IsOptional()
  transactionId?: string;

  @IsObject()
  @IsOptional()
  billingSnapshot?: Record<string, any>;
}

export class UpdateOrderPartStatusDto {
  @IsString()
  status: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  documents?: string[];
}

export class CreateOrderDocumentDto {
  @IsString()
  @IsNotEmpty()
  document_type: string;

  @IsString()
  @IsNotEmpty()
  document_url: string;

  @IsString()
  @IsNotEmpty()
  file_name: string;

  @IsString()
  @IsNotEmpty()
  mime_type: string;

  @IsString()
  @IsNotEmpty()
  uploaded_by: string;

  @IsBoolean()
  @IsOptional()
  is_active?: boolean;

  @IsObject()
  @IsNotEmpty()
  @IsOptional()
  metadata?: Record<string, any>;

  @IsString()
  @IsOptional()
  visibility?: string;
}

export class UpdateOrderDocumentDto {
  @IsString()
  @IsOptional()
  visibility?: string;

  @IsBoolean()
  @IsOptional()
  is_active?: boolean;

  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;
}

export class CapturePaypalDto {
  @IsString()
  @IsNotEmpty()
  orderID: string;
}

export class ApproveStatusDto {}

export class RejectStatusDto {
  @IsString()
  @IsNotEmpty()
  rejection_reason: string;
}
