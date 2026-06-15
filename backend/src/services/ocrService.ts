import { GoogleGenerativeAI } from '@google/generative-ai';

/**
 * OCR Service - handles image processing and text extraction using Google Gemini Vision API
 */
export class OCRService {
  private genAI: GoogleGenerativeAI;
  private model: any;

  constructor(apiKey: string, modelName = 'gemini-2.5-flash') {
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY environment variable is not set');
    }
    this.genAI = new GoogleGenerativeAI(apiKey);
    // Flash keeps OCR latency and cost low while supporting image inputs.
    this.model = this.genAI.getGenerativeModel({ model: modelName });
  }

  /**
   * Extract text from image using Google Gemini Vision API
   * @param imageBuffer Buffer containing image data
   * @returns Extracted text from the image
   */
  async extractTextFromImage(imageBuffer: Buffer): Promise<string> {
    try {
      // Convert buffer to base64
      const base64Image = imageBuffer.toString('base64');

      // Determine MIME type from magic bytes
      const mimeType = this.getMimeTypeFromBuffer(imageBuffer);

      // Structured prompt for alcohol label field extraction
//       const extractionPrompt = `You are an expert at extracting information from alcohol beverage labels.
      
// Please extract the following fields from this alcohol label image:
// 1. Brand Name (the main product/brand name)
// 2. Class/Type (e.g., Bourbon, Whiskey, Vodka, Wine, Beer, Gin, Rum, etc.)
// 3. Alcohol Content (ABV percentage or proof)
// 4. Net Contents (volume in mL, oz, L, etc.)
// 5. Bottler Name (name of the bottling company)
// 6. Bottler Address (city, state, country)
// 7. Country of Origin (if applicable for imports)
// 8. Government Warning Statement (the complete warning text)

// Return ONLY the extracted text for each field, one per line in this exact format:
// [BRAND_NAME]: text_here
// [CLASS_TYPE]: text_here
// [ALCOHOL_CONTENT]: text_here
// [NET_CONTENTS]: text_here
// [BOTTLER_NAME]: text_here
// [BOTTLER_ADDRESS]: text_here
// [COUNTRY_OF_ORIGIN]: text_here
// [GOVERNMENT_WARNING]: text_here

// If a field is not visible or cannot be determined, write "NOT_FOUND" for that field.
// Do not include any other text or explanations.`;
      const extractionPrompt = `You are a TTB (Alcohol and Tobacco Tax and Trade Bureau) compliance expert analyzing an alcohol beverage label image.

Carefully examine ALL text visible on the label — front, back, and sides if shown — and extract the following fields:

1. BRAND_NAME: The largest, most prominent product name on the label (e.g., "Jack Daniel's", "Grey Goose", "Maker's Mark")

2. CLASS_TYPE: The official product designation, usually printed below the brand name (e.g., "Kentucky Straight Bourbon Whiskey", "American Vodka", "Blended Scotch Whisky", "Dry Gin")

3. ALCOHOL_CONTENT: Look for "ALC/VOL", "ABV", "PROOF", or "% alcohol by volume" — capture the full string (e.g., "40% alc/vol", "80 Proof", "40% ALC. BY VOL., "5% ALC./VOL.")

4. NET_CONTENTS: The bottle volume, usually near the bottom of the front label or embossed on glass — look for mL, L, oz, fl oz (e.g., "750 mL", "1 L", "375 mL", "1.75 L", "1 PINT 0.9 FL. OZ.")

5. BOTTLER_NAME: The company name following words like "Bottled by", "Distilled by", "Produced by", "Imported by" (e.g., "Brown-Forman Distillers Corporation")

6. BOTTLER_ADDRESS: The city, state, and/or country that follows the bottler name (e.g., "Louisville, KY 40210", "Cognac, France")

7. COUNTRY_OF_ORIGIN: Only present on imported products, look for "Product of", "Distilled in", "Imported from" (e.g., "Product of Scotland", "Distilled in France")

8. GOVERNMENT_WARNING: The mandatory US health warning — look for a text block starting with "GOVERNMENT WARNING:" in bold or all-caps, usually on the back label. Capture the COMPLETE warning text word for word.

Return your response as a valid JSON object with exactly these keys:
{
  "BRAND_NAME": "value or NOT_FOUND",
  "CLASS_TYPE": "value or NOT_FOUND",
  "ALCOHOL_CONTENT": "value or NOT_FOUND",
  "NET_CONTENTS": "value or NOT_FOUND",
  "BOTTLER_NAME": "value or NOT_FOUND",
  "BOTTLER_ADDRESS": "value or NOT_FOUND",
  "COUNTRY_OF_ORIGIN": "value or NOT_FOUND",
  "GOVERNMENT_WARNING": "value or NOT_FOUND"
}

Return ONLY the JSON object. No explanation, no markdown, no code blocks.`;

      // Call Gemini Vision API
      const response = await this.model.generateContent([
        {
          inlineData: {
            data: base64Image,
            mimeType: mimeType,
          },
        },
        {
          text: extractionPrompt,
        },
      ]);

      // Extract text from response
      const result = await response.response;
      const extractedText = result.text();

      if (!extractedText || extractedText.trim().length === 0) {
        throw new Error('Gemini returned empty response');
      }

      return extractedText;
    } catch (error) {
      console.error('Gemini OCR extraction failed:', error);
      if (error instanceof Error) {
        throw new Error(`Failed to extract text from image: ${error.message}`);
      }
      throw new Error('Failed to extract text from image');
    }
  }

  /**
   * Detect MIME type from image buffer magic bytes
   * @param buffer Image buffer
   * @returns MIME type string
   */
  private getMimeTypeFromBuffer(buffer: Buffer): string {
    // Check magic bytes
    if (buffer.length < 4) {
      return 'image/jpeg'; // default
    }

    // JPEG: FF D8 FF
    if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
      return 'image/jpeg';
    }

    // PNG: 89 50 4E 47
    if (
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47
    ) {
      return 'image/png';
    }

    // GIF: 47 49 46 (GIF87a or GIF89a)
    if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46) {
      return 'image/gif';
    }

    // WebP: RIFF ... WEBP
    if (
      buffer[0] === 0x52 &&
      buffer[1] === 0x49 &&
      buffer[2] === 0x46 &&
      buffer[3] === 0x46
    ) {
      // Check for WEBP signature at bytes 8-12
      if (
        buffer.length > 12 &&
        buffer[8] === 0x57 &&
        buffer[9] === 0x45 &&
        buffer[10] === 0x42 &&
        buffer[11] === 0x50
      ) {
        return 'image/webp';
      }
    }

    // Default to JPEG
    return 'image/jpeg';
  }
}
