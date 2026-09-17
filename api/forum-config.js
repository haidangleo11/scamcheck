module.exports = (req, res) => {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  const url = String(process.env.SUPABASE_URL || '').replace(/\/$/, '');
  const anonKey = String(process.env.SUPABASE_ANON_KEY || '');
  if (!url || !anonKey) {
    return res.status(503).json({ error: 'Forum configuration is not ready.' });
  }

  res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=300');
  return res.status(200).json({ url, anonKey });
};
