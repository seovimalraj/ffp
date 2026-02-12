import { IsBoolean, IsEnum, IsString } from 'class-validator';
import { RoleNames } from '../../libs/constants';

export class AuthDto {
  @IsString()
  email: string;

  @IsString()
  password: string;
}
export class RegisterDto {
  @IsString()
  email: string;

  @IsString()
  password: string;

  @IsString()
  organization_name: string;

  @IsString()
  name: string;

  @IsString()
  phone: string;

  referralSource?: string;
}

export class RefreshTokenDto {
  @IsString()
  refreshToken: string;

  @IsString()
  userId: string;
}

export class LogoutDto {
  @IsString()
  userId: string;
}

export class CurrentUserDto {
  @IsString()
  id: string;

  @IsString()
  organizationId: string;

  @IsString()
  email: string;

  @IsEnum(RoleNames)
  role: RoleNames;

  @IsBoolean()
  verified: boolean;

  @IsString()
  name: string;
}
