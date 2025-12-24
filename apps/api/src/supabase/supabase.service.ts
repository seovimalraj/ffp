import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseService {
  private supabase: SupabaseClient;
  private readonly logger = new Logger(SupabaseService.name);
  private readonly configService = new ConfigService();
  constructor() {
    const url = this.configService.get<string>('SUPABASE_URL');
    const key = this.configService.get<string>('SUPABASE_KEY');

    if (!url || !key) {
      this.logger.error(
        'Supabase URL or Key not found in environment variables.',
      );
      throw new Error(
        'Supabase URL or Key not found in environment variables.',
      );
    }

    this.supabase = createClient(url, key);
  }

  getClient(): SupabaseClient {
    return this.supabase;
  }

  getSupabaseClient(user: { id: string; role: string }) {
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_KEY,
    );

    supabase.rpc('set_config', { key: 'jwt.claims.id', value: user.id });
    supabase.rpc('set_config', { key: 'jwt.claims.role', value: user.role });

    return supabase;
  }

  async refreshMaterializedView(mv_function_name: string): Promise<void> {
    const { error } = await this.supabase.rpc(mv_function_name);

    if (error) {
      this.logger.error(
        `Error refreshing user permission codes: ${error.message}`,
      );
      throw new Error(
        `Error refreshing user permission codes: ${error.message}`,
      );
    }
  }

  async uploadFile(
    // eslint-disable-next-line no-undef
    file: Express.Multer.File,
    bucket: string = 'uploads',
    path?: string,
  ) {
    if (!path) {
      path = `FFP-${Date.now()}-${file.originalname}`;
    }

    const { error } = await this.supabase.storage
      .from(bucket)
      .upload(path, file.buffer, {
        contentType: file.mimetype,
        upsert: true,
      });

    if (error) {
      this.logger.error(`Error uploading file: ${error.message}`);
      throw new Error(`Error uploading file: ${error.message}`);
    }

    return this.getPublicUrl(bucket, path);
  }

  getPublicUrl(bucket: string, path: string) {
    const { data } = this.supabase.storage.from(bucket).getPublicUrl(path);
    return data.publicUrl;
  }
}
