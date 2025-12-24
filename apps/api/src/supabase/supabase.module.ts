import { Module } from '@nestjs/common';
import { SupabaseService } from './supabase.service';
import { SupabaseController } from './supabase.controller';

@Module({
    providers: [SupabaseService],
    exports: [SupabaseService],
    controllers: [SupabaseController],
})
export class SupabaseModule {}
