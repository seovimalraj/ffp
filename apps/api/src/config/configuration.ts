export default () => ({
  port: parseInt(process.env.PORT || '4001', 10),
  frontendUrl: process.env.FRONTEND_URL,
  supabase: {
    url: process.env.SUPABASE_URL,
    key: process.env.SUPABASE_KEY,
  },
  nodeEnv: process.env.NODE_ENV || 'development',
});
