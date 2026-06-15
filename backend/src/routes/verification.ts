import { Router, Request, Response } from 'express';
import multer from 'multer';
import AdmZip from 'adm-zip';
import { parse as csvParse } from 'csv-parse/sync';
import { OCRService } from '../services/ocrService';
import { LabelVerificationService } from '../services/labelVerificationService';
import { VerificationRequest, BatchVerificationRequest, LabelData } from '../types';

export const verificationRouter = Router();

let ocrService: OCRService | undefined;
const verificationService = new LabelVerificationService();

function logJson(label: string, value: unknown): void {
  // eslint-disable-next-line no-console
  console.log(`${label}:\n${JSON.stringify(value, null, 2)}`);
}

function getOCRService(): OCRService {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '';

  if (!apiKey) {
    throw new Error(
      'GEMINI_API_KEY environment variable is not set. Create backend/.env with GEMINI_API_KEY=your_gemini_api_key and restart the backend.'
    );
  }

  if (!ocrService) {
    ocrService = new OCRService(apiKey, process.env.GEMINI_MODEL || 'gemini-2.5-flash');
  }

  return ocrService;
}

// Configure multer
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

// Separate multer config for CSV+ZIP batch upload (no mime filter)
const batchUpload = multer({
  storage,
  limits: { fileSize: 500 * 1024 * 1024 } // 500MB for ZIP files
});

/**
 * POST /api/verification/verify-label
 * Verify a single label against application data
 */
verificationRouter.post(
  '/verify-label',
  upload.single('image'),
  async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No image file provided' });
      }

      const { labelId, applicationData } = req.body;

      if (!labelId || !applicationData) {
        return res.status(400).json({ error: 'Missing labelId or applicationData' });
      }

      const startTime = Date.now();

      // Extract text from image
      const extractedText = await getOCRService().extractTextFromImage(req.file.buffer);
      // eslint-disable-next-line no-console
      console.log(`extractedText:\n${extractedText}`);


      // Parse extracted text
      const extractedData = verificationService.parseExtractedText(extractedText);
      logJson('extractedData', extractedData);

      // Verify data
      const parsedApplicationData = typeof applicationData === 'string'
        ? JSON.parse(applicationData)
        : applicationData;
      logJson('applicationData', parsedApplicationData);

      const result = verificationService.createVerificationResult(
        labelId,
        req.file.originalname,
        extractedData,
        parsedApplicationData,
        Date.now() - startTime
      );

      res.json(result);
    } catch (error) {
      console.error('Verification error:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Verification failed'
      });
    }
  }
);

/**
 * POST /api/verification/verify-batch
 * Verify multiple labels in batch
 */
verificationRouter.post(
  '/verify-batch',
  upload.array('images', 300), // Max 300 files per batch
  async (req: Request, res: Response) => {
    try {
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({ error: 'No image files provided' });
      }

      const { batchId, applicationsData } = req.body;

      if (!batchId || !applicationsData) {
        return res.status(400).json({ error: 'Missing batchId or applicationsData' });
      }

      const startTime = Date.now();
      const files = Array.isArray(req.files) ? req.files : [];
      const applications = typeof applicationsData === 'string'
        ? JSON.parse(applicationsData)
        : applicationsData;

      const results = [];

      // Process each image
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const appData = applications[i];

        try {
          const labelStartTime = Date.now();

          // Extract text
          const extractedText = await getOCRService().extractTextFromImage(file.buffer);
          const extractedData = verificationService.parseExtractedText(extractedText);
          logJson(`batch extractedData ${i}`, extractedData);

          // Create verification result
          const result = verificationService.createVerificationResult(
            `${batchId}-${i}`,
            file.originalname,
            extractedData,
            appData || {},
            Date.now() - labelStartTime
          );

          results.push(result);
        } catch (error) {
          console.error(`Error processing file ${i}:`, error);
          results.push({
            labelId: `${batchId}-${i}`,
            filename: file.originalname,
            extractedData: {},
            fieldVerifications: [],
            overallMatch: false,
            matchPercentage: 0,
            processingTime: Date.now() - startTime,
            timestamp: new Date().toISOString(),
            error: error instanceof Error ? error.message : 'Processing failed'
          } as any);
        }
      }

      res.json({
        batchId,
        totalLabels: files.length,
        processedLabels: results.length,
        results,
        batchProcessingTime: Date.now() - startTime,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Batch verification error:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Batch verification failed'
      });
    }
  }
);

/**
 * POST /api/verification/verify-json
 * Verify label data sent as JSON with base64 encoded image
 */
verificationRouter.post('/verify-json', async (req: Request, res: Response) => {
  try {
    const { labelId, filename, imageBase64, applicationData }: VerificationRequest = req.body;

    if (!labelId || !imageBase64 || !applicationData) {
      return res.status(400).json({
        error: 'Missing required fields: labelId, imageBase64, applicationData'
      });
    }

    const startTime = Date.now();

    // Convert base64 to buffer
    const imageBuffer = Buffer.from(imageBase64, 'base64');

    // Extract text
    const extractedText = await getOCRService().extractTextFromImage(imageBuffer);
    const extractedData = verificationService.parseExtractedText(extractedText);
    logJson('json extractedData', extractedData);

    // Create result
    const result = verificationService.createVerificationResult(
      labelId,
      filename || 'label.jpg',
      extractedData,
      applicationData,
      Date.now() - startTime
    );

    res.json(result);
  } catch (error) {
    console.error('JSON verification error:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Verification failed'
    });
  }
});

/**
 * POST /api/verification/verify-batch-csv
 * Verify labels from CSV application data + ZIP of label images.
 * Streams results back via Server-Sent Events (SSE).
 */
verificationRouter.post(
  '/verify-batch-csv',
  batchUpload.fields([
    { name: 'csvFile', maxCount: 1 },
    { name: 'zipFile', maxCount: 1 }
  ]),
  async (req: Request, res: Response) => {
    // Set up SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering
    res.flushHeaders();

    const sendEvent = (data: unknown) => {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    try {
      const files = req.files as { [fieldname: string]: Express.Multer.File[] };
      const csvFileArr = files?.csvFile;
      const zipFileArr = files?.zipFile;

      if (!csvFileArr || csvFileArr.length === 0) {
        sendEvent({ type: 'error', message: 'No CSV file provided' });
        res.write('data: [DONE]\n\n');
        return res.end();
      }

      if (!zipFileArr || zipFileArr.length === 0) {
        sendEvent({ type: 'error', message: 'No ZIP file provided' });
        res.write('data: [DONE]\n\n');
        return res.end();
      }

      // Parse CSV
      const csvBuffer = csvFileArr[0].buffer;
      let csvRows: Record<string, string>[];
      try {
        csvRows = csvParse(csvBuffer, {
          columns: true,
          skip_empty_lines: true,
          trim: true,
          relax_column_count: true
        }) as Record<string, string>[];
      } catch (csvError) {
        sendEvent({ type: 'error', message: `CSV parse error: ${csvError instanceof Error ? csvError.message : 'Invalid CSV'}` });
        res.write('data: [DONE]\n\n');
        return res.end();
      }

      // Extract ZIP
      let zip: AdmZip;
      try {
        zip = new AdmZip(zipFileArr[0].buffer);
      } catch (zipError) {
        sendEvent({ type: 'error', message: `ZIP extraction error: ${zipError instanceof Error ? zipError.message : 'Invalid ZIP'}` });
        res.write('data: [DONE]\n\n');
        return res.end();
      }

      const zipEntries = zip.getEntries();
      // Build a map of filename -> buffer (handle nested directories by using basename)
      const imageMap = new Map<string, Buffer>();
      for (const entry of zipEntries) {
        if (!entry.isDirectory) {
          const basename = entry.entryName.split('/').pop() || entry.entryName;
          imageMap.set(basename, entry.getData());
          // Also store with full path for exact match
          imageMap.set(entry.entryName, entry.getData());
        }
      }

      const total = csvRows.length;
      const batchId = `batch-${Date.now()}`;
      // eslint-disable-next-line no-console
      console.log(`Starting batch verification: ${total} rows, ${imageMap.size} images`);

      // Process each row sequentially
      for (let i = 0; i < csvRows.length; i++) {
        const row = csvRows[i];
        const filename = row.filename || row.Filename || '';

        // Build application data from CSV row
        const applicationData: LabelData = {
          brandName: row.brandName || row.brand_name || row.BrandName || undefined,
          classType: row.classType || row.class_type || row.ClassType || undefined,
          alcoholContent: row.alcoholContent || row.alcohol_content || row.AlcoholContent || undefined,
          netContents: row.netContents || row.net_contents || row.NetContents || undefined,
          bottlerName: row.bottlerName || row.bottler_name || row.BottlerName || undefined,
          bottlerAddress: row.bottlerAddress || row.bottler_address || row.BottlerAddress || undefined,
          countryOfOrigin: row.countryOfOrigin || row.country_of_origin || row.CountryOfOrigin || undefined,
          governmentWarning: row.governmentWarning || row.government_warning || row.GovernmentWarning || undefined
        };

        // Find image in ZIP
        const imageBuffer = imageMap.get(filename);

        if (!imageBuffer) {
          // Image not found - emit error result
          const errorResult = {
            labelId: `${batchId}-${i}`,
            filename: filename || `row-${i + 1}`,
            extractedData: {},
            fieldVerifications: [],
            overallMatch: false,
            matchPercentage: 0,
            processingTime: 0,
            timestamp: new Date().toISOString(),
            status: 'fail' as const,
            error: `Image "${filename}" not found in ZIP archive`
          };

          sendEvent({
            type: 'result',
            result: errorResult,
            processed: i + 1,
            total
          });
          continue;
        }

        try {
          const labelStartTime = Date.now();

          // OCR extraction
          const extractedText = await getOCRService().extractTextFromImage(imageBuffer);
          const extractedData = verificationService.parseExtractedText(extractedText);

          // Verification
          const verificationResult = verificationService.createVerificationResult(
            `${batchId}-${i}`,
            filename,
            extractedData,
            applicationData,
            Date.now() - labelStartTime
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

          const batchRowResult = {
            ...verificationResult,
            status
          };

          sendEvent({
            type: 'result',
            result: batchRowResult,
            processed: i + 1,
            total
          });
        } catch (error) {
          console.error(`Error processing ${filename}:`, error);

          const errorResult = {
            labelId: `${batchId}-${i}`,
            filename,
            extractedData: {},
            fieldVerifications: [],
            overallMatch: false,
            matchPercentage: 0,
            processingTime: 0,
            timestamp: new Date().toISOString(),
            status: 'fail' as const,
            error: error instanceof Error ? error.message : 'Processing failed'
          };

          sendEvent({
            type: 'result',
            result: errorResult,
            processed: i + 1,
            total
          });
        }
      }

      // Signal completion
      sendEvent({ type: 'done' });
      res.write('data: [DONE]\n\n');
      res.end();
    } catch (error) {
      console.error('Batch CSV verification error:', error);
      sendEvent({
        type: 'error',
        message: error instanceof Error ? error.message : 'Batch verification failed'
      });
      res.write('data: [DONE]\n\n');
      res.end();
    }
  }
);

export default verificationRouter;
