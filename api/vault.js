// In-memory vault — resets on cold start; swap for KV/DB for persistence
let userVault = [];

export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'GET') {
    return res.json({ success: true, data: userVault });
  }

  if (req.method === 'POST') {
    const { recipeId, title, cookedAt = new Date().toISOString(), rating = 5 } = req.body;
    const entry = { id: `vault-${Date.now()}`, recipeId, title, cookedAt, rating };
    userVault.unshift(entry);
    return res.json({ success: true, data: userVault });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
