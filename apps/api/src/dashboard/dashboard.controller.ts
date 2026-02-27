import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { BlogService } from './blog.service';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { RoleNames } from '../../libs/constants';
import { CurrentUser } from '../auth/user.decorator';
import { CurrentUserDto } from '../auth/auth.dto';
import { CreateBlogDto, UpdateBlogDto } from './blog.dto';

@Controller('portal/dashboard')
@UseGuards(AuthGuard, RolesGuard)
export class DashboardController {
  constructor(
    private readonly dashboardService: DashboardService,
    private readonly blogService: BlogService,
  ) {}

  @Get('stats')
  @Roles(RoleNames.Customer)
  async getStats(@CurrentUser() user: CurrentUserDto) {
    return this.dashboardService.getStats(user.organizationId, user.id);
  }

  @Get('recent-quotes')
  @Roles(RoleNames.Customer)
  async getRecentQuotes(@CurrentUser() user: CurrentUserDto) {
    return this.dashboardService.getRecentQuotes(user.organizationId, user.id);
  }

  @Get('recent-orders')
  @Roles(RoleNames.Customer)
  async getRecentOrders(@CurrentUser() user: CurrentUserDto) {
    return this.dashboardService.getRecentOrders(user.organizationId);
  }

  @Get('blogs')
  @Roles(RoleNames.Customer, RoleNames.Admin)
  async getBlogs(
    @CurrentUser() user: CurrentUserDto,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ) {
    const isAdmin = user.role === RoleNames.Admin;
    return this.blogService.getBlogs(isAdmin, limit, offset);
  }

  @Post('blogs')
  @Roles(RoleNames.Admin)
  async createBlog(@Body() createBlogDto: CreateBlogDto) {
    return this.blogService.createBlog(createBlogDto);
  }

  @Patch('blogs/:id')
  @Roles(RoleNames.Admin)
  async updateBlog(
    @Param('id') id: string,
    @Body() updateBlogDto: UpdateBlogDto,
  ) {
    return this.blogService.updateBlog(id, updateBlogDto);
  }

  @Delete('blogs/:id')
  @Roles(RoleNames.Admin)
  async deleteBlog(@Param('id') id: string) {
    return this.blogService.deleteBlog(id);
  }
}
