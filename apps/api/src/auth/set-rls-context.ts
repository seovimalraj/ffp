import { SupabaseClient } from '@supabase/supabase-js';

export async function setRlsContext(
  supabase: SupabaseClient,
  userId: string,
  isAdmin = false,
) {
  await supabase.rpc('set_config', {
    key: 'request.user_id',
    value: userId,
  });

  await supabase.rpc('set_config', {
    key: 'request.is_admin',
    value: String(isAdmin),
  });
}
