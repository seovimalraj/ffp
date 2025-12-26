import {
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
  UseGuards,
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
