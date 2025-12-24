// scripts/check-supabase-connection.js
const path = require('path');
// Resolve .env relative to this script's directory so the script loads the
// intended `apps/api-v2/.env` regardless of the current working directory.
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const { createClient } = require('@supabase/supabase-js');

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_KEY;

console.log(url, " ", key)
if (!url || !key) {
  console.error('Missing SUPABASE_URL or SUPABASE_KEY');
  process.exit(1);
}

const supabase = createClient(url, key);

(async () => {
  try {
    // simple health query: list one row from a known table (replace 'quotes' with a table you have)
    const { data, error, status } = await supabase.from('users').select('id').limit(1);
    if (error) {
      console.error('Supabase query error:', error);
      process.exit(1);
    }
    console.log('Supabase query success, status:', status, 'sample data:', data);
  } catch (err) {
    console.error('Supabase connectivity error:', err);
    process.exit(1);
  }
})();