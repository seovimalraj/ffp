import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { Tables } from '../../libs/constants';
import { SupabaseService } from 'src/supabase/supabase.service';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from './public.decorator';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();

    try {
      const user = await this.validateRequest(request);
      request.user = user;
      return true;
    } catch (error) {
      throw new UnauthorizedException('Unauthorized', error);
    }
  }

  private async validateRequest(request: any): Promise<any> {
    const authHeader = request.headers.authorization;
    const sessionData = request.headers['x-session-data'];

    let userId: string;

    if (authHeader?.startsWith('Bearer ')) {
      userId = authHeader.substring(7); // Remove 'Bearer ' prefix
    } else if (sessionData) {
      try {
        const parsedSession = JSON.parse(sessionData);
        userId = parsedSession.id;
      } catch (error) {
        throw new UnauthorizedException('Invalid session data', error);
      }
    } else {
      throw new UnauthorizedException('No authentication provided');
    }

    const client = this.supabaseService.getClient();
    const { data: user, error } = await client
      .from(Tables.UserTable)
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      throw new UnauthorizedException('User not found');
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      verified: user.verified,
      phone: user.phone,
      organizationId: user.organization_id,
    };
  }
}
