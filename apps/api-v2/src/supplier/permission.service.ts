import { SupabaseService } from 'src/supabase/supabase.service';
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { StockMaterial, CurrencyType, Tables } from 'libs/constants';

@Injectable()
export class PermissionService {
  constructor(private readonly supabaseService: SupabaseService) {}

  async addPermission() {}
}
