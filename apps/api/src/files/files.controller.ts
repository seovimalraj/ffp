import {
  Controller,
  Get,
  Post,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
  UseGuards,
  InternalServerErrorException,
  Query,
} from '@nestjs/common';
import { SupabaseService } from 'src/supabase/supabase.service';
import { FileInterceptor } from '@nestjs/platform-express';
import { BucketNames, SQLFunctions } from '../../libs/constants';
import { CurrentUser } from 'src/auth/user.decorator';
import { CurrentUserDto } from 'src/auth/auth.dto';
import { AuthGuard } from 'src/auth/auth.guard';

@Controller('files')
@UseGuards(AuthGuard)
export class FilesController {
  constructor(private readonly supabaseService: SupabaseService) {}

  @Get('/rfq')
  async getRFQFiles(
    @CurrentUser() user: CurrentUserDto,
    @Query('status') status?: string,
    @Query('limit') limit?: number,
    @Query('cursorCreatedAt') cursorCreatedAt?: string,
    @Query('cursorRfqId') cursorRfqId?: string,
  ) {
    const client = this.supabaseService.getClient();

    const params: any = {
      p_organization_id: user.organizationId,
    };

    if (status) {
      params.p_status = status;
    }

    if (limit) {
      params.p_rfq_limit = limit;
    }

    if (cursorCreatedAt) {
      params.p_cursor_created_at = cursorCreatedAt;
    }

    if (cursorRfqId) {
      params.p_cursor_rfq_id = cursorRfqId;
    }

    let query = client.rpc(SQLFunctions.getRFQPartsInfinite, params);

    const { data, error } = await query;

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
