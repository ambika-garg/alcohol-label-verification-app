import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * GET /api/health
 * Health check endpoint — reports OCR configuration status.
 */
export default function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '';
  const modelName = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

  return res.status(200).json({
    status: 'ok',
    ocrConfigured: apiKey.length > 0,
    ocrModel: modelName,
    timestamp: new Date().toISOString(),
  });
}
