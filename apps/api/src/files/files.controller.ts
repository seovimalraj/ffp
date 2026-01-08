import {
  Controller,
  Get,
  Post,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
  UseGuards,
  InternalServerErrorException,
} from '@nestjs/common';
import { SupabaseService } from 'src/supabase/supabase.service';
import { FileInterceptor } from '@nestjs/platform-express';
import { BucketNames } from '../../libs/constants';
import { CurrentUser } from 'src/auth/user.decorator';
import { CurrentUserDto } from 'src/auth/auth.dto';
import { AuthGuard } from 'src/auth/auth.guard';

@Controller('files')
@UseGuards(AuthGuard)
export class FilesController {
  constructor(private readonly supabaseService: SupabaseService) {}

  @Get('/rfq')
  async getRFQFiles(@CurrentUser() user: CurrentUserDto) {
    const client = this.supabaseService.getClient();

    const { data, error } = await client
      .from('rfq_parts')
      .select(
        `
      id,
      rfq_id,
      file_name,
      cad_file_url,
      cad_file_type,
      snapshot_2d_url,
      status,
      material,
      quantity,
      lead_time,
      lead_time_type,
      final_price,

      rfq (
        id,
        rfq_code,
        status
      ),

      part_drawing_2d (
        id,
        file_name,
        file_url,
        mime_type,
        created_at
      )
    `,
      )
      .eq('organization_id', user.organizationId);

    if (error) {
      throw new InternalServerErrorException(error.message);
    }

    return data;
  }

  @Post()
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(
    // eslint-disable-next-line no-undef
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: CurrentUserDto,
  ) {
    if (!file) {
      throw new BadRequestException('File is required');
    }

    const publicUrl = await this.supabaseService.uploadFile(
      file,
      BucketNames.rfqStore,
      undefined,
      {
        id: user.id,
        role: user.role,
      },
    );

    return {
      message: 'File uploaded successfully',
      url: publicUrl,
    };
  }
}
