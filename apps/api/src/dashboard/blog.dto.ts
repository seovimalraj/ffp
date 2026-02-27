import {
  IsString,
  IsNotEmpty,
  IsUrl,
  IsBoolean,
  IsOptional,
} from 'class-validator';

export class CreateBlogDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsUrl()
  @IsNotEmpty()
  link: string;

  @IsUrl()
  @IsNotEmpty()
  image_url: string;

  @IsBoolean()
  @IsOptional()
  showcase?: boolean;
}

export class UpdateBlogDto {
  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsUrl()
  @IsOptional()
  link?: string;

  @IsUrl()
  @IsOptional()
  image_url?: string;

  @IsBoolean()
  @IsOptional()
  showcase?: boolean;
}
