import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { Tables } from '../../libs/constants';

@Injectable()
export class BlogService {
  private readonly logger = new Logger(BlogService.name);
  constructor(private readonly supabaseService: SupabaseService) {}
  async getBlogs(isAdmin: boolean, limit = 10, offset = 0) {
    const client = this.supabaseService.getClient();

    const parsedLimit = Math.min(limit || 10, 50);
    const parsedOffset = offset || 0;

    try {
      let query = client
        .from(Tables.BlogsTable)
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(parsedOffset, parsedOffset + parsedLimit - 1);

      if (!isAdmin) {
        query = query.eq('showcase', true);
      }

      const { data, error, count } = await query;

      if (error) {
        this.logger.error({ error }, 'Failed to fetch blogs');
        throw new Error('Failed to fetch blogs');
      }

      const total = count ?? 0;

      const nextOffset =
        parsedOffset + parsedLimit < total ? parsedOffset + parsedLimit : null;

      return {
        success: true,
        data: data ?? [],
        pagination: {
          offset: parsedOffset,
          limit: parsedLimit,
          nextOffset,
          total,
          hasMore: nextOffset !== null,
        },
      };
    } catch (error) {
      this.logger.error({ error }, 'Error while getting blogs');
      throw error;
    }
  }

  async createBlog(blogData: any) {
    const client = this.supabaseService.getClient();
    try {
      const { data, error } = await client
        .from(Tables.BlogsTable)
        .insert([blogData])
        .select()
        .single();

      if (error) {
        this.logger.error({ error }, 'Failed to create blog');
        throw new Error(`Failed to create blog: ${error.message}`);
      }

      return { success: true, data };
    } catch (error) {
      this.logger.error({ error }, 'Error while creating blog');
      throw error;
    }
  }

  async updateBlog(id: string, blogData: any) {
    const client = this.supabaseService.getClient();
    try {
      const { data, error } = await client
        .from(Tables.BlogsTable)
        .update(blogData)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        this.logger.error({ error }, 'Failed to update blog');
        throw new Error(`Failed to update blog: ${error.message}`);
      }

      return { success: true, data };
    } catch (error) {
      this.logger.error({ error }, 'Error while updating blog');
      throw error;
    }
  }

  async deleteBlog(id: string) {
    const client = this.supabaseService.getClient();
    try {
      const { error } = await client
        .from(Tables.BlogsTable)
        .delete()
        .eq('id', id);

      if (error) {
        this.logger.error({ error }, 'Failed to delete blog');
        throw new Error(`Failed to delete blog: ${error.message}`);
      }

      return { success: true };
    } catch (error) {
      this.logger.error({ error }, 'Error while deleting blog');
      throw error;
    }
  }
}
