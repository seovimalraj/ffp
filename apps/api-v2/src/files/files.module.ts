import { Module } from '@nestjs/common';
import { FilesController } from './files.controller';
import { MulterModule } from '@nestjs/platform-express';
import { SupabaseModule } from 'src/supabase/supabase.module';

@Module({
  imports: [
    MulterModule.register({
      // No storage option defaults to memory storage (file.buffer is available)
    }),
    SupabaseModule,
  ],
  controllers: [FilesController],
  providers: [],
})
export class FilesModule {}
