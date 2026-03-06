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
  Body,
  UploadedFiles,
  Param,
} from '@nestjs/common';
import { SupabaseService } from 'src/supabase/supabase.service';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { BucketNames, SQLFunctions, Tables } from '../../libs/constants';
import { CurrentUser } from 'src/auth/user.decorator';
import { CurrentUserDto } from 'src/auth/auth.dto';
import { AuthGuard } from 'src/auth/auth.guard';
import { Public } from 'src/auth/public.decorator';

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

  @Public()
  @Post()
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(
    // eslint-disable-next-line no-undef
    @UploadedFile() file: Express.Multer.File,
    @Body()
    body: {
      requireUploadId: boolean;
    },
  ) {
    if (!file) {
      throw new BadRequestException('File is required');
    }

    const requireUploadId =
      body.requireUploadId === true ||
      String(body.requireUploadId).toLowerCase() === 'true';

    const meta = await this.supabaseService.uploadFile(
      file,
      BucketNames.rfqStore,
      undefined,
      requireUploadId,
    );

    return {
      message: 'File uploaded successfully',
      url: meta.publicUrl,
      uploadId: meta.uploadId,
    };
  }

  @Public()
  @Post('bulk')
  @UseInterceptors(FilesInterceptor('files'))
  async uploadFilesWithUploadId(
    // eslint-disable-next-line no-undef
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    if (!files?.length) {
      throw new BadRequestException('No files were uploaded');
    }

    const uploadedFiles = await Promise.all(
      files.map(async (file) => {
        const meta = await this.supabaseService.uploadFile(
          file,
          BucketNames.rfqStore,
          undefined,
          false,
        );
        return meta.publicUrl;
      }),
    );

    const { data, error } = await this.supabaseService
      .getClient()
      .from(Tables.UploadsTable)
      .insert({
        file_urls: uploadedFiles,
      })
      .select()
      .single();

    if (error) {
      throw new InternalServerErrorException(error.message);
    }

    return {
      message: 'Uploaded successfully',
      uploadId: data.id,
    };
  }

  @Public()
  @Get('bulk/:uploadId')
  async getUploads(@Param('uploadId') uploadId: string) {
    const { data, error } = await this.supabaseService
      .getClient()
      .from(Tables.UploadsTable)
      .select('file_urls')
      .eq('id', uploadId)
      .single();

    if (error) {
      throw new InternalServerErrorException(error);
    }

    return {
      data: data.file_urls,
    };
  }
}
