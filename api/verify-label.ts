import type { VercelRequest, VercelResponse } from '@vercel/node';
import Busboy from 'busboy';
import { OCRService } from '../lib/ocrService';
import { LabelVerificationService } from '../lib/labelVerificationService';

export const config = { api: { bodyParser: false } };

// Module-level singletons
const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '';
const modelName = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const ocrService = apiKey ? new OCRService(apiKey, modelName) : null;
const verificationService = new LabelVerificationService();

interface MultipartResult {
  fields: Record<string, string>;
  file: { buffer: Buffer; filename: string } | null;
}

/**
 * Parse multipart/form-data using busboy.
 * Collects a single file (field name "image") and all text fields.
 */
function parseMultipart(req: VercelRequest): Promise<MultipartResult> {
  return new Promise((resolve, reject) => {
    const fields: Record<string, string> = {};
    let file: { buffer: Buffer; filename: string } | null = null;

    const busboy = Busboy({ headers: req.headers as Record<string, string> });

    busboy.on('field', (name: string, value: string) => {
      fields[name] = value;
    });

    busboy.on('file', (name: string, stream: NodeJS.ReadableStream, info: { filename: string }) => {
      if (name !== 'image') {
        // Drain unexpected file streams
        stream.resume();
        return;
      }

      const chunks: Buffer[] = [];
      stream.on('data', (chunk: Buffer) => chunks.push(chunk));
      stream.on('end', () => {
        file = { buffer: Buffer.concat(chunks), filename: info.filename };
      });
    });

    busboy.on('finish', () => resolve({ fields, file }));
    busboy.on('error', (err: Error) => reject(err));

    req.pipe(busboy);
  });
}

/**
 * POST /api/verify-label
 * Verify a single label image against application data.
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
    const { fields, file } = await parseMultipart(req);

    if (!file) {
      return res.status(400).json({ error: 'No image file provided' });
    }

    const { labelId, applicationData } = fields;

    if (!labelId || !applicationData) {
      return res.status(400).json({ error: 'Missing labelId or applicationData' });
    }

    const startTime = Date.now();

    // OCR extraction
    const extractedText = await ocrService.extractTextFromImage(file.buffer);
    console.log(`extractedText:\n${extractedText}`);

    // Parse extracted text
    const extractedData = verificationService.parseExtractedText(extractedText);
    console.log(`extractedData:\n${JSON.stringify(extractedData, null, 2)}`);

    // Parse application data
    const parsedApplicationData = typeof applicationData === 'string'
      ? JSON.parse(applicationData)
      : applicationData;
    console.log(`applicationData:\n${JSON.stringify(parsedApplicationData, null, 2)}`);

    // Build verification result
    const result = verificationService.createVerificationResult(
      labelId,
      file.filename,
      extractedData,
      parsedApplicationData,
      Date.now() - startTime,
    );

    return res.status(200).json(result);
  } catch (error) {
    console.error('Verification error:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Verification failed',
    });
  }
}
