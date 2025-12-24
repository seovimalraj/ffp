import { SetMetadata } from '@nestjs/common';
import { MetaNames } from '../../libs/constants';

export function RequirePermissions(...permissions: string[]) {
  return SetMetadata(MetaNames.permissionsMetaKey, permissions);
}
