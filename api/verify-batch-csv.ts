import type { VercelRequest, VercelResponse } from '@vercel/node';
import Busboy from 'busboy';
import AdmZip from 'adm-zip';
import { parse as csvParse } from 'csv-parse/sync';
import { OCRService } from '../lib/ocrService';
import { LabelVerificationService } from '../lib/labelVerificationService';
import type { LabelData } from '../lib/types';

export const config = { api: { bodyParser: false } };

// Module-level singletons
const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '';
const modelName = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const ocrService = apiKey ? new OCRService(apiKey, modelName) : null;
const verificationService = new LabelVerificationService();

interface UploadedFile {
  buffer: Buffer;
  filename: string;
  fieldName: string;
}

interface MultipartResult {
  fields: Record<string, string>;
  files: UploadedFile[];
}

/**
 * Parse multipart/form-data collecting named files (csvFile, zipFile)
 * and any text fields.
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
      const chunks: Buffer[] = [];
      stream.on('data', (chunk: Buffer) => chunks.push(chunk));
      stream.on('end', () => {
        files.push({
          buffer: Buffer.concat(chunks),
          filename: info.filename,
          fieldName: name,
        });
      });
    });

    busboy.on('finish', () => resolve({ fields, files }));
    busboy.on('error', (err: Error) => reject(err));

    req.pipe(busboy);
  });
}

/**
 * Send an SSE event to the response stream.
 */
function sendEvent(res: VercelResponse, data: unknown): void {
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

/**
 * POST /api/verify-batch-csv
 * Verify labels from CSV application data + ZIP of label images.
 * Streams results back via Server-Sent Events (SSE).
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

  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  try {
    const { files } = await parseMultipart(req);

    const csvFile = files.find((f) => f.fieldName === 'csvFile');
    const zipFile = files.find((f) => f.fieldName === 'zipFile');

    if (!csvFile) {
      sendEvent(res, { type: 'error', message: 'No CSV file provided' });
      res.write('data: [DONE]\n\n');
      return res.end();
    }

    if (!zipFile) {
      sendEvent(res, { type: 'error', message: 'No ZIP file provided' });
      res.write('data: [DONE]\n\n');
      return res.end();
    }

    // --- Parse CSV ---
    let csvRows: Record<string, string>[];
    try {
      csvRows = csvParse(csvFile.buffer, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
        relax_column_count: true,
      }) as Record<string, string>[];
    } catch (csvError) {
      sendEvent(res, {
        type: 'error',
        message: `CSV parse error: ${csvError instanceof Error ? csvError.message : 'Invalid CSV'}`,
      });
      res.write('data: [DONE]\n\n');
      return res.end();
    }

    // --- Extract ZIP ---
    let zip: AdmZip;
    try {
      zip = new AdmZip(zipFile.buffer);
    } catch (zipError) {
      sendEvent(res, {
        type: 'error',
        message: `ZIP extraction error: ${zipError instanceof Error ? zipError.message : 'Invalid ZIP'}`,
      });
      res.write('data: [DONE]\n\n');
      return res.end();
    }

    // Build filename → buffer map (basename + full path for flexible matching)
    const imageMap = new Map<string, Buffer>();
    for (const entry of zip.getEntries()) {
      if (!entry.isDirectory) {
        const basename = entry.entryName.split('/').pop() || entry.entryName;
        imageMap.set(basename, entry.getData());
        imageMap.set(entry.entryName, entry.getData());
      }
    }

    const total = csvRows.length;
    const batchId = `batch-${Date.now()}`;
    console.log(`Starting batch verification: ${total} rows, ${imageMap.size} images`);

    // --- Process each CSV row sequentially ---
    for (let i = 0; i < csvRows.length; i++) {
      const row = csvRows[i];
      const filename = row.filename || row.Filename || '';

      // Build application data with flexible column-name support
      const applicationData: LabelData = {
        brandName: row.brandName || row.brand_name || row.BrandName || undefined,
        classType: row.classType || row.class_type || row.ClassType || undefined,
        alcoholContent: row.alcoholContent || row.alcohol_content || row.AlcoholContent || undefined,
        netContents: row.netContents || row.net_contents || row.NetContents || undefined,
        bottlerName: row.bottlerName || row.bottler_name || row.BottlerName || undefined,
        bottlerAddress: row.bottlerAddress || row.bottler_address || row.BottlerAddress || undefined,
        countryOfOrigin: row.countryOfOrigin || row.country_of_origin || row.CountryOfOrigin || undefined,
        governmentWarning: row.governmentWarning || row.government_warning || row.GovernmentWarning || undefined,
      };

      // Find image in ZIP
      const imageBuffer = imageMap.get(filename);

      if (!imageBuffer) {
        sendEvent(res, {
          type: 'result',
          result: {
            labelId: `${batchId}-${i}`,
            filename: filename || `row-${i + 1}`,
            extractedData: {},
            fieldVerifications: [],
            overallMatch: false,
            matchPercentage: 0,
            processingTime: 0,
            timestamp: new Date().toISOString(),
            status: 'fail',
            error: `Image "${filename}" not found in ZIP archive`,
          },
          processed: i + 1,
          total,
        });
        continue;
      }

      try {
        const labelStartTime = Date.now();

        // OCR extraction
        const extractedText = await ocrService.extractTextFromImage(imageBuffer);
        const extractedData = verificationService.parseExtractedText(extractedText);

        // Verification
        const verificationResult = verificationService.createVerificationResult(
          `${batchId}-${i}`,
          filename,
          extractedData,
          applicationData,
          Date.now() - labelStartTime,
        );

        // Classify result
        let status: 'pass' | 'fail' | 'needs-review';
        if (verificationResult.overallMatch) {
          status = 'pass';
        } else if (verificationResult.matchPercentage >= 50) {
          status = 'needs-review';
        } else {
          status = 'fail';
        }

        sendEvent(res, {
          type: 'result',
          result: { ...verificationResult, status },
          processed: i + 1,
          total,
        });
      } catch (error) {
        console.error(`Error processing ${filename}:`, error);

        sendEvent(res, {
          type: 'result',
          result: {
            labelId: `${batchId}-${i}`,
            filename,
            extractedData: {},
            fieldVerifications: [],
            overallMatch: false,
            matchPercentage: 0,
            processingTime: 0,
            timestamp: new Date().toISOString(),
            status: 'fail',
            error: error instanceof Error ? error.message : 'Processing failed',
          },
          processed: i + 1,
          total,
        });
      }
    }

    // Signal completion
    sendEvent(res, { type: 'done' });
    res.write('data: [DONE]\n\n');
    return res.end();
  } catch (error) {
    console.error('Batch CSV verification error:', error);
    sendEvent(res, {
      type: 'error',
      message: error instanceof Error ? error.message : 'Batch verification failed',
    });
    res.write('data: [DONE]\n\n');
    return res.end();
  }
}
