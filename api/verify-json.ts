import type { VercelRequest, VercelResponse } from '@vercel/node';
import { OCRService } from '../lib/ocrService';
import { LabelVerificationService } from '../lib/labelVerificationService';
import type { VerificationRequest } from '../lib/types';

// Module-level singletons
const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '';
const modelName = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const ocrService = apiKey ? new OCRService(apiKey, modelName) : null;
const verificationService = new LabelVerificationService();

/**
 * POST /api/verify-json
 * Verify label data sent as JSON with base64-encoded image.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!ocrService) {
    return res.status(500).json({ error: 'OCR service not configured — GEMINI_API_KEY is missing' });
  }

  try {
    const { labelId, filename, imageBase64, applicationData } = req.body as VerificationRequest;

    if (!labelId || !imageBase64 || !applicationData) {
      return res.status(400).json({
        error: 'Missing required fields: labelId, imageBase64, applicationData',
      });
    }

    const startTime = Date.now();

    // Convert base64 to buffer
    const imageBuffer = Buffer.from(imageBase64, 'base64');

    // OCR extraction
    const extractedText = await ocrService.extractTextFromImage(imageBuffer);
    const extractedData = verificationService.parseExtractedText(extractedText);
    console.log(`json extractedData:\n${JSON.stringify(extractedData, null, 2)}`);

    // Build verification result
    const result = verificationService.createVerificationResult(
      labelId,
      filename || 'label.jpg',
      extractedData,
      applicationData,
      Date.now() - startTime,
    );

    return res.status(200).json(result);
  } catch (error) {
    console.error('JSON verification error:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Verification failed',
    });
  }
}
