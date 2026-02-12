import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Tables } from '../../libs/constants';
import { SupabaseService } from 'src/supabase/supabase.service';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly jwtService: JwtService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
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
      const token = authHeader.substring(7);
      try {
        const decoded = this.jwtService.verify(token);
        userId = decoded.sub;
        if (!userId) {
          throw new UnauthorizedException('Invalid token payload: missing sub');
        }
      } catch (error) {
        throw new UnauthorizedException('Invalid or expired token');
      }
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
      .select('id, email, name, role, organization_id')
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
      organizationId: user.organization_id,
    };
  }
}
