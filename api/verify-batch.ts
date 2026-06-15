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

interface UploadedFile {
  buffer: Buffer;
  filename: string;
}

interface MultipartResult {
  fields: Record<string, string>;
  files: UploadedFile[];
}

/**
 * Parse multipart/form-data with multiple files (field name "images")
 * and text fields (batchId, applicationsData).
 */
function parseMultipart(req: VercelRequest): Promise<MultipartResult> {
  return new Promise((resolve, reject) => {
    const fields: Record<string, string> = {};
    const files: UploadedFile[] = [];

    const busboy = Busboy({ headers: req.headers as Record<string, string> });

    busboy.on('field', (name: string, value: string) => {
      fields[name] = value;
    });

    busboy.on('file', (name: string, stream: NodeJS.ReadableStream, info: { filename: string }) => {
      if (name !== 'images') {
        stream.resume();
        return;
      }

      const chunks: Buffer[] = [];
      stream.on('data', (chunk: Buffer) => chunks.push(chunk));
      stream.on('end', () => {
        files.push({ buffer: Buffer.concat(chunks), filename: info.filename });
      });
    });

    busboy.on('finish', () => resolve({ fields, files }));
    busboy.on('error', (err: Error) => reject(err));

    req.pipe(busboy);
  });
}

/**
 * POST /api/verify-batch
 * Verify multiple label images in a single request.
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
    const { fields, files } = await parseMultipart(req);

    if (files.length === 0) {
      return res.status(400).json({ error: 'No image files provided' });
    }

    const { batchId, applicationsData } = fields;

    if (!batchId || !applicationsData) {
      return res.status(400).json({ error: 'Missing batchId or applicationsData' });
    }

    const startTime = Date.now();
    const applications = typeof applicationsData === 'string'
      ? JSON.parse(applicationsData)
      : applicationsData;

    const results = [];

    // Process each image sequentially
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const appData = applications[i];

      try {
        const labelStartTime = Date.now();

        const extractedText = await ocrService.extractTextFromImage(file.buffer);
        const extractedData = verificationService.parseExtractedText(extractedText);
        console.log(`batch extractedData ${i}:\n${JSON.stringify(extractedData, null, 2)}`);

        const result = verificationService.createVerificationResult(
          `${batchId}-${i}`,
          file.filename,
          extractedData,
          appData || {},
          Date.now() - labelStartTime,
        );

        results.push(result);
      } catch (error) {
        console.error(`Error processing file ${i}:`, error);
        results.push({
          labelId: `${batchId}-${i}`,
          filename: file.filename,
          extractedData: {},
          fieldVerifications: [],
          overallMatch: false,
          matchPercentage: 0,
          processingTime: Date.now() - startTime,
          timestamp: new Date().toISOString(),
          error: error instanceof Error ? error.message : 'Processing failed',
        });
      }
    }

    return res.status(200).json({
      batchId,
      totalLabels: files.length,
      processedLabels: results.length,
      results,
      batchProcessingTime: Date.now() - startTime,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Batch verification error:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Batch verification failed',
    });
  }
}
