import {
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Logger,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { SupabaseService } from 'src/supabase/supabase.service';
import { AuthGuard } from './auth.guard';
import { CurrentUser } from './user.decorator';

import { compare, hash } from 'bcrypt';
import { randomBytes } from 'crypto';
import { RoleNames, SQLFunctions, Tables } from '../../libs/constants';
import {
  AuthDto,
  CurrentUserDto,
  LogoutDto,
  RefreshTokenDto,
} from './auth.dto';
import { TemporalService } from 'src/temporal/temporal.service';
import { isOtpValid } from './auth.utils';
import { Roles } from './roles.decorator';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly jwtService: JwtService,
    private readonly logger: Logger,
    private readonly temporalService: TemporalService,
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
        this.logger.error(error);
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
        verified: user.verified,
        organizationId: user.organization_id || null,
        accessToken: accessToken,
        refreshToken: refreshToken,
      };
      return result;
    } catch (error) {
      this.logger.error(error);
      if (error instanceof Error) {
        throw error;
      }

      throw new HttpException(
        'Internal Server Error',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('register')
  async register(@Body() body: any) {
    try {
      const {
        email,
        password,
        organization_name,
        name,
        phone,
        referralSource,
      } = body;

      // Hash the password
      const hashedPassword = await hash(password, 12);

      const client = this.supabaseService.getClient();
      const { data: user, error } = await client.rpc(SQLFunctions.createUser, {
        p_email: email,
        p_password: hashedPassword,
        p_organization_name: organization_name,
        p_name: name,
        p_phone: phone,
        p_source: referralSource || '',
      });

      if (error) {
        // Handle unique violation or other errors from RPC
        if (error.code === '23505') {
          throw new HttpException(
            'User or organization already exists',
            HttpStatus.CONFLICT,
          );
        }
        throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
      }

      if (!user) {
        throw new HttpException(
          'Failed to create user',
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }

      // Generate Refresh Token
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
          'User created but failed to generate session. Please login.',
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

      // this.temporalService.sendEmail({
      //       to: email,
      //       subject: 'Welcome to Frigate Fast Parts',
      //       text: '', // or provide a text body
      //       name: name,
      //       type: 'welcome',
      //     }),

      try {
        await this.temporalService.otpWorkflow({
          email: email,
          username: name,
        });
      } catch (err) {
        this.logger.error({ err }, 'Failed to send OTP via Temporal');
      }
      return {
        id: user.id,
        email: user.email,
        name: user.full_name || user.name || user.email,
        role: user.role,
        organizationId: user.organization_id || null,
        accessToken: accessToken,
        refreshToken: refreshToken,
      };
    } catch (error) {
      console.error(error);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        error.message || 'Internal Server Error',
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

  @Post('verify-otp')
  @Roles(RoleNames.Customer)
  async verifyOTP(
    @Body() body: { code: string },
    @CurrentUser() currentUser: CurrentUserDto,
  ) {
    try {
      const client = this.supabaseService.getClient();

      const { error, data } = await client
        .from(Tables.OTPTable)
        .select('code, expires_at')
        .eq('email', currentUser.email)
        .single();

      if (error || !data) {
        throw new HttpException('OTP not found', HttpStatus.NOT_FOUND);
      }

      // 1. Check Expiry FIRST
      if (!isOtpValid(data.expires_at)) {
        this.logger.error(`OTP Expired for ${currentUser.email}`);

        // Trigger Temporal workflow for a new code
        await this.temporalService.otpWorkflow({
          email: currentUser.email,
          username: currentUser.name,
        });

        throw new HttpException(
          'OTP Expired. A new code has been sent.',
          HttpStatus.GONE,
        );
      }

      // 2. Check Code Validity
      if (data.code !== body.code) {
        this.logger.error('Invalid OTP attempt');
        throw new HttpException('Invalid OTP Token', HttpStatus.UNAUTHORIZED);
      }

      // 3. Success - Update User
      const { error: updateUserError } = await client
        .from(Tables.UserTable)
        .update({ verified: true }) // Pass as object
        .eq('id', currentUser.id);

      if (updateUserError) {
        throw new Error('Database update failed');
      }

      // 4. Cleanup (Optional but Recommended)
      // Delete the OTP so it cannot be used again
      await client
        .from(Tables.OTPTable)
        .delete()
        .eq('email', currentUser.email);

      return { success: true, message: 'Account verified successfully' };
    } catch (error) {
      this.logger.error({ error }, 'Failed to verify OTP');

      // Re-throw if it's already an HttpException, otherwise send 500
      if (error instanceof HttpException) throw error;
      throw new HttpException(
        'Internal Server Error',
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
