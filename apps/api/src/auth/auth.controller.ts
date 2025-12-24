import {
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { SupabaseService } from 'src/supabase/supabase.service';
import { AuthGuard } from './auth.guard';
import { CurrentUser } from './user.decorator';

import { compare, hash } from 'bcrypt';
import { randomBytes } from 'crypto';
import { Tables } from '../../libs/constants';
import { AuthDto, LogoutDto, RefreshTokenDto } from './auth.dto';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly jwtService: JwtService,
  ) {}

  @Get('profile')
  @UseGuards(AuthGuard)
  async getProfile(@CurrentUser() user: any) {
    return user;
  }

  @Post('login')
  async login(@Body() body: AuthDto) {
    try {
      const { email, password } = body;

      if (!email || !password) {
        throw new HttpException(
          'Email and password are required',
          HttpStatus.BAD_REQUEST,
        );
      }

      const client = this.supabaseService.getClient();
      const { data: user, error } = await client
        .from(Tables.UserTable)
        .select('*')
        .eq('email', email)
        .single();

      if (error || !user) {
        throw new HttpException('Invalid credentials', HttpStatus.UNAUTHORIZED);
      }

      const isPasswordValid = await compare(password, user.password_hash);

      if (!isPasswordValid) {
        throw new HttpException('Invalid credentials', HttpStatus.UNAUTHORIZED);
      }

      const refreshToken = randomBytes(32).toString('hex');
      const refreshTokenHash = await hash(refreshToken, 12);
      const refreshTokenExpiresAt = new Date();
      refreshTokenExpiresAt.setDate(refreshTokenExpiresAt.getDate() + 30);

      const { error: refreshTokenError } = await client
        .from(Tables.RefreshTokensTable)
        .upsert(
          {
            user_id: user.id,
            token: refreshTokenHash,
            expires_at: refreshTokenExpiresAt.toISOString(),
          },
          { onConflict: 'user_id' },
        );

      if (refreshTokenError) {
        console.error(refreshTokenError);
        throw new HttpException(
          'Failed to generate refresh token',
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }

      // Generate JWT access token
      const accessToken = this.jwtService.sign({
        sub: user.id,
        email: user.email,
        role: user.role,
        organizationId: user.organization_id || null,
      });

      const result = {
        id: user.id,
        email: user.email,
        name: user.full_name || user.name || user.email,
        role: user.role,
        organizationId: user.organization_id || null,
        accessToken: accessToken,
        refreshToken: refreshToken,
      };
      return result;
    } catch (error) {
      console.error(error);
      if (error instanceof Error) {
        throw error;
      }

      throw new HttpException(
        'Internal Server Error',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('refresh')
  async refreshToken(@Body() body: RefreshTokenDto) {
    try {
      const { refreshToken, userId } = body;

      if (!refreshToken || !userId) {
        throw new HttpException(
          'Refresh token and user ID are required',
          HttpStatus.BAD_REQUEST,
        );
      }

      const client = this.supabaseService.getClient();

      // Get user info
      const { data: user, error: userError } = await client
        .from(Tables.UserTable)
        .select('*')
        .eq('id', userId)
        .single();

      if (userError || !user) {
        throw new HttpException('User not found', HttpStatus.UNAUTHORIZED);
      }

      const { data: tokenData, error: tokenError } = await client
        .from(Tables.RefreshTokensTable)
        .select('*')
        .eq('user_id', userId)
        .single();

      if (tokenError || !tokenData) {
        throw new HttpException(
          'No valid refresh token',
          HttpStatus.UNAUTHORIZED,
        );
      }

      const tokenExpiresAt = new Date(tokenData.expires_at);
      const now = new Date();

      if (tokenExpiresAt < now) {
        // Delete expired token
        await client
          .from(Tables.RefreshTokensTable)
          .delete()
          .eq('user_id', userId);
        throw new HttpException(
          'Refresh token expired',
          HttpStatus.UNAUTHORIZED,
        );
      }

      const isValidRefreshToken = await compare(refreshToken, tokenData.token);

      if (!isValidRefreshToken) {
        throw new HttpException(
          'Invalid refresh token',
          HttpStatus.UNAUTHORIZED,
        );
      }

      // Generate new JWT access token
      const accessToken = this.jwtService.sign({
        sub: user.id,
        email: user.email,
        role: user.role,
        organizationId: user.organization_id || null,
      });

      const result = {
        id: user.id,
        email: user.email,
        name: user.full_name || user.name || user.email,
        role: user.role || 'customer',
        organizationId: user.organization_id || null,
        accessToken: accessToken,
        refreshToken: refreshToken,
      };

      return result;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Internal server error',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('logout')
  async logout(@Body() body: LogoutDto) {
    try {
      const { userId } = body;

      if (!userId) {
        throw new HttpException('User ID is required', HttpStatus.BAD_REQUEST);
      }

      const client = this.supabaseService.getClient();
      const { error } = await client
        .from(Tables.RefreshTokensTable)
        .delete()
        .eq('user_id', userId);

      if (error) {
        throw new HttpException(
          'Failed to invalidate refresh token',
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }

      return { message: 'Logged out successfully' };
    } catch (error) {
      console.error(error);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Internal server error',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
