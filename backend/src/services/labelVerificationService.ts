import { LabelData, FieldVerification, VerificationResult } from '../types';
import { GovernmentWarningValidator } from './governmentWarningValidator';

/**
 * Label Verification Service - handles parsing and verification of label data
 */
export class LabelVerificationService {
  private governmentWarningValidator = new GovernmentWarningValidator();
  /**
   * Parse extracted text to identify label fields
   * @param extractedText Raw OCR text
   * @returns Parsed label data
   */
  parseExtractedText(extractedText: string): LabelData {
    const parsedJsonData = this.parseJsonExtractedText(extractedText);
    if (parsedJsonData) {
      return parsedJsonData;
    }

    const labelData: LabelData = {};
    const lines = extractedText.split('\n').filter(line => line.trim());

    // Simple parsing logic - can be enhanced with ML/pattern matching
    for (const line of lines) {
      const trimmed = line.trim();

      // Brand name (typically first prominent text)
      if (!labelData.brandName && trimmed.length > 3 && trimmed.length < 50) {
        labelData.brandName = trimmed;
      }

      // Alcohol content
      if (!labelData.alcoholContent && /(\d+\.?\d*)\s*(%|Alc|VOL|Proof)/i.test(trimmed)) {
        labelData.alcoholContent = trimmed;
      }

      // Net contents (volume)
      if (!labelData.netContents && /(mL|ml|oz|L|liter)/i.test(trimmed)) {
        labelData.netContents = trimmed;
      }

      // Government warning (key phrase search)
      if (!labelData.governmentWarning && /GOVERNMENT WARNING/i.test(trimmed)) {
        labelData.governmentWarning = trimmed;
      }

      // Class/Type
      if (!labelData.classType && /(bourbon|whiskey|vodka|gin|rum|wine|beer|spirit)/i.test(trimmed)) {
        labelData.classType = trimmed;
      }
    }

    return labelData;
  }

  /**
   * Parse the structured JSON response returned by the OCR prompt.
   * @param extractedText Raw Gemini response text
   * @returns Parsed label data, or undefined when the response is not JSON
   */
  private parseJsonExtractedText(extractedText: string): LabelData | undefined {
    const jsonText = this.extractJsonObject(extractedText);

    if (!jsonText) {
      return undefined;
    }

    try {
      const parsed = JSON.parse(jsonText) as Record<string, unknown>;

      return {
        brandName: this.getExtractedJsonValue(parsed, 'BRAND_NAME', 'brandName'),
        classType: this.getExtractedJsonValue(parsed, 'CLASS_TYPE', 'classType'),
        alcoholContent: this.getExtractedJsonValue(parsed, 'ALCOHOL_CONTENT', 'alcoholContent'),
        netContents: this.getExtractedJsonValue(parsed, 'NET_CONTENTS', 'netContents'),
        bottlerName: this.getExtractedJsonValue(parsed, 'BOTTLER_NAME', 'bottlerName'),
        bottlerAddress: this.getExtractedJsonValue(parsed, 'BOTTLER_ADDRESS', 'bottlerAddress'),
        countryOfOrigin: this.getExtractedJsonValue(parsed, 'COUNTRY_OF_ORIGIN', 'countryOfOrigin'),
        governmentWarning: this.getExtractedJsonValue(parsed, 'GOVERNMENT_WARNING', 'governmentWarning')
      };
    } catch (error) {
      console.warn('Failed to parse OCR JSON response:', error);
      return undefined;
    }
  }

  /**
   * Extract a JSON object even when the model wraps it in markdown fences.
   * @param text Raw model output
   * @returns JSON object text, or undefined when no object is found
   */
  private extractJsonObject(text: string): string | undefined {
    const trimmed = text.trim();
    const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    const candidate = fencedMatch ? fencedMatch[1].trim() : trimmed;

    if (candidate.startsWith('{') && candidate.endsWith('}')) {
      return candidate;
    }

    const firstBrace = candidate.indexOf('{');
    const lastBrace = candidate.lastIndexOf('}');

    if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
      return undefined;
    }

    return candidate.slice(firstBrace, lastBrace + 1);
  }

  /**
   * Convert OCR JSON values into optional LabelData values.
   * @param value Raw JSON field value
   * @returns String value, or undefined for missing/NOT_FOUND values
   */
  private normalizeExtractedValue(value: unknown): string | undefined {
    if (typeof value !== 'string') {
      return undefined;
    }

    const trimmed = value.trim();
    if (!trimmed || trimmed === 'NOT_FOUND') {
      return undefined;
    }

    return trimmed;
  }

  /**
   * Read a field from model JSON, allowing exact prompt keys and camelCase variants.
   * @param parsed Parsed model response object
   * @param keys Candidate keys to read
   * @returns Normalized field value
   */
  private getExtractedJsonValue(parsed: Record<string, unknown>, ...keys: string[]): string | undefined {
    const normalizedEntries = Object.entries(parsed).reduce<Record<string, unknown>>((acc, [key, value]) => {
      acc[this.normalizeJsonKey(key)] = value;
      return acc;
    }, {});

    for (const key of keys) {
      const value = parsed[key] ?? normalizedEntries[this.normalizeJsonKey(key)];
      const normalizedValue = this.normalizeExtractedValue(value);

      if (normalizedValue) {
        return normalizedValue;
      }
    }

    return undefined;
  }

  /**
   * Normalize model JSON keys for resilient matching.
   * @param key JSON object key
   * @returns Lowercase alphanumeric key
   */
  private normalizeJsonKey(key: string): string {
    return key.toLowerCase().replace(/[^a-z0-9]/g, '');
  }

  /**
   * Verify extracted data against application data
   * @param extractedData Data extracted from image
   * @param applicationData Data from application submission
   * @returns Verification results for each field
   */
  verifyData(extractedData: LabelData, applicationData: LabelData): FieldVerification[] {
    const verifications: FieldVerification[] = [];
    const fields = [
      'brandName',
      'classType',
      'alcoholContent',
      'netContents',
      'bottlerName',
      'bottlerAddress',
      'countryOfOrigin',
      'governmentWarning'
    ];

    for (const field of fields) {
      const expectedValue = applicationData[field];
      const extractedValue = extractedData[field];

      const verification = this.verifyField(
        field,
        expectedValue,
        extractedValue
      );

      verifications.push(verification);
    }

    return verifications;
  }

  /**
   * Verify a single field
   * @param fieldName Name of the field
   * @param expectedValue Value from application
   * @param extractedValue Value from image
   * @returns Verification result with matchTier
   */
  private verifyField(
    fieldName: string,
    expectedValue: string | undefined,
    extractedValue: string | undefined
  ): FieldVerification {
    // If no expected value, skip verification (no matchTier assigned)
    if (!expectedValue) {
      return {
        fieldName,
        extractedValue,
        isMatch: true,
        confidence: 0.0,
        notes: 'No value to verify'
      };
    }

    // If no extracted value, it's a mismatch
    if (!extractedValue) {
      // For government warning, still run the validator to produce sub-results
      if (fieldName === 'governmentWarning') {
        const gwResult = this.governmentWarningValidator.validate(undefined);
        return {
          fieldName,
          expectedValue,
          extractedValue: undefined,
          isMatch: false,
          confidence: 0.0,
          matchTier: 'mismatch',
          notes: 'Government warning not found in image',
          governmentWarningResult: gwResult
        };
      }
      return {
        fieldName,
        expectedValue,
        extractedValue: undefined,
        isMatch: false,
        confidence: 0.0,
        matchTier: 'mismatch',
        notes: 'Field not found in image'
      };
    }

    // Government Warning — always delegate to the dedicated strict validator
    // (must run before the generic match logic so sub-results are always populated)
    if (fieldName === 'governmentWarning') {
      const gwResult = this.governmentWarningValidator.validate(extractedValue);
      return {
        fieldName,
        expectedValue,
        extractedValue,
        isMatch: gwResult.subResults.find(s => s.check === 'presence')?.passed === true
              && gwResult.subResults.find(s => s.check === 'textAccuracy')?.passed === true,
        confidence: gwResult.overallPass ? 1.0 : 0.0,
        notes: gwResult.subResults.map(s => `${s.check}: ${s.passed ? '✅' : '❌'}`).join(' | '),
        governmentWarningResult: gwResult
      };
    }

    // ── Three-tier matching for all other fields ──

    // Tier 1: Exact match (identical strings)
    if (expectedValue === extractedValue) {
      return {
        fieldName,
        expectedValue,
        extractedValue,
        isMatch: true,
        confidence: 1.0,
        matchTier: 'exact'
      };
    }

    // Normalize both values: lowercase, strip punctuation, collapse whitespace
    const normalizedExpected = this.normalizeForComparison(expectedValue);
    const normalizedExtracted = this.normalizeForComparison(extractedValue);

    // Tier 2a: Normalized equality (case, punctuation, whitespace differences only)
    if (normalizedExpected === normalizedExtracted) {
      return {
        fieldName,
        expectedValue,
        extractedValue,
        isMatch: true,
        confidence: 1.0,
        matchTier: 'probable',
        notes: 'Probable match — differs in case, punctuation, or whitespace only'
      };
    }

    // Tier 2b: Levenshtein similarity on normalized strings
    const similarity = this.calculateSimilarity(expectedValue, extractedValue);
    const threshold = 0.85;

    if (similarity >= threshold) {
      return {
        fieldName,
        expectedValue,
        extractedValue,
        isMatch: true,
        confidence: similarity,
        matchTier: 'probable',
        notes: `Probable match — ${(similarity * 100).toFixed(0)}% similar`
      };
    }

    // Tier 3: Mismatch
    return {
      fieldName,
      expectedValue,
      extractedValue,
      isMatch: false,
      confidence: similarity,
      matchTier: 'mismatch',
      notes: `Mismatch — ${(similarity * 100).toFixed(0)}% similar`
    };
  }

  /**
   * Normalize a string for comparison: lowercase, strip punctuation, collapse whitespace.
   */
  private normalizeForComparison(str: string): string {
    return str
      .toLowerCase()
      .replace(/[^\w\s]/g, '')   // strip punctuation
      .replace(/\s+/g, ' ')      // collapse whitespace
      .trim();
  }

  /**
   * Calculate string similarity using Levenshtein distance
   * @param str1 First string
   * @param str2 Second string
   * @returns Similarity score (0-1)
   */
  private calculateSimilarity(str1: string, str2: string): number {
    // Normalize strings for comparison
    const s1 = str1.toLowerCase().replace(/[^\w\s]/g, '');
    const s2 = str2.toLowerCase().replace(/[^\w\s]/g, '');

    if (s1 === s2) return 1.0;

    const distance = this.levenshteinDistance(s1, s2);
    const maxLength = Math.max(s1.length, s2.length);

    return 1 - (distance / maxLength);
  }

  /**
   * Calculate Levenshtein distance between two strings
   * @param str1 First string
   * @param str2 Second string
   * @returns Edit distance
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const m = str1.length;
    const n = str2.length;
    const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));

    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;

    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        if (str1[i - 1] === str2[j - 1]) {
          dp[i][j] = dp[i - 1][j - 1];
        } else {
          dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
        }
      }
    }

    return dp[m][n];
  }

  // Government warning verification is now handled by GovernmentWarningValidator

  /**
   * Calculate overall match percentage
   * @param verifications Field verifications
   * @returns Match percentage (0-100)
   */
  calculateMatchPercentage(verifications: FieldVerification[]): number {
    const comparableVerifications = verifications.filter(v => v.expectedValue);

    if (comparableVerifications.length === 0) return 0;

    const matchCount = comparableVerifications.filter(v => v.isMatch).length;
    return (matchCount / comparableVerifications.length) * 100;
  }

  /**
   * Determine overall match status
   * @param verifications Field verifications
   * @returns True if all critical fields match
   */
  isOverallMatch(verifications: FieldVerification[]): boolean {
    const criticalFields = ['brandName', 'alcoholContent', 'governmentWarning'];
    
    for (const critical of criticalFields) {
      const verification = verifications.find(v => v.fieldName === critical);
      if (!verification?.expectedValue || !verification.extractedValue || !verification.isMatch) {
        return false;
      }
    }

    return true;
  }

  /**
   * Create verification result
   * @param labelId Label ID
   * @param filename Filename
   * @param extractedData Extracted data
   * @param applicationData Application data
   * @param processingTime Time taken to process
   * @returns Verification result
   */
  createVerificationResult(
    labelId: string,
    filename: string,
    extractedData: LabelData,
    applicationData: LabelData,
    processingTime: number
  ): VerificationResult {
    const fieldVerifications = this.verifyData(extractedData, applicationData);
    const matchPercentage = this.calculateMatchPercentage(fieldVerifications);
    const overallMatch = this.isOverallMatch(fieldVerifications);

    return {
      labelId,
      filename,
      extractedData,
      fieldVerifications,
      overallMatch,
      matchPercentage,
      processingTime,
      timestamp: new Date().toISOString()
    };
  }
}
