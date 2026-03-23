import { IsOptional, IsString } from 'class-validator';

export class CreateQuoteRequestDTO {
  @IsString()
  order_id: string;

  @IsString()
  supplier_id: string;

  @IsString()
  contact_user: string;

  @IsString()
  @IsOptional()
  notes: string;
}

export class DeclineQuoteRequestDTO {
  @IsString()
  reason: string;
}

export class CancelQuoteRequestDTO {
  @IsString()
  reason: string;
}
