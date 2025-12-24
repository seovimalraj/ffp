import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { MetaNames } from '../../libs/constants';
import { PermissionCheckService } from './permisson-check.service';
import { checkIfExist } from '../../libs/helpers';

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly permissionCheckService: PermissionCheckService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      MetaNames.permissionsMetaKey,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredPermissions.length) {
      return true;
    }

    const req = context.switchToHttp().getRequest();

    const user = req.user as
      | { id: string; userId: string; role: string }
      | undefined;

    if (!user) {
      throw new ForbiddenException('Unauthenticated');
    }

    const organizationId: string | undefined = req.user.organizationId;
    const role: string | undefined = req.user.role;
    if (!organizationId && !checkIfExist(['admin', 'customer'], role)) {
      throw new ForbiddenException('Organization ID is required');
    }

    const hasAny = await this.permissionCheckService.hasAnyPermission({
      userId: user.id,
      organizationId,
      permissionCodes: requiredPermissions,
      role,
    });

    if (!hasAny) {
      throw new ForbiddenException('Forbidden');
    }

    return true;
  }
}
