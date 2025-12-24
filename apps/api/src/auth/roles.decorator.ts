import { SetMetadata } from '@nestjs/common';
import { MetaNames } from '../../libs/constants';

export const Roles = (...roles: string[]) =>
  SetMetadata(MetaNames.rolesMetaKey, roles);
