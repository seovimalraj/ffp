import {
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { SupabaseService } from 'src/supabase/supabase.service';
import { FileInterceptor } from '@nestjs/platform-express';
import { BucketNames } from 'libs/constants';

@Controller('files')
export class FilesController {
  constructor(private readonly supabaseService: SupabaseService) {}

  @Post()
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('File is required');
    }

    const publicUrl = await this.supabaseService.uploadFile(
      file,
      BucketNames.storage,
    );

    return {
      message: 'File uploaded successfully',
      url: publicUrl,
    };
  }
}
