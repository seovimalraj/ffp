import { IsEnum, IsString } from 'class-validator';
import { RoleNames } from '../../libs/constants';

export class AuthDto {
  @IsString()
  email: string;

  @IsString()
  password: string;
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
}
