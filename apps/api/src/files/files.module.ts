import { Module } from '@nestjs/common';
import { FilesController } from './files.controller';
import { MulterModule } from '@nestjs/platform-express';
import { SupabaseModule } from 'src/supabase/supabase.module';

@Module({
  imports: [
    MulterModule.register({
      // Memory storage: file.buffer is available for direct Supabase upload.
      // Enforce 100 MB limit to prevent memory exhaustion from oversized uploads.
      limits: { fileSize: 100 * 1024 * 1024 },
    }),
    SupabaseModule,
  ],
  controllers: [FilesController],
  providers: [],
})
export class FilesModule {}
