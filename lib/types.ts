/**
 * Represents the data from an alcohol label
 */
export interface LabelData {
  brandName?: string;
  classType?: string;
  alcoholContent?: string;
  netContents?: string;
  bottlerName?: string;
  bottlerAddress?: string;
  countryOfOrigin?: string;
  governmentWarning?: string;
  [key: string]: string | undefined;
}

/**
 * Represents a field verification result
 */
export interface FieldVerification {
  fieldName: string;
  expectedValue?: string;
  extractedValue?: string;
  isMatch: boolean;
  confidence: number;
  notes?: string;
}

/**
 * Represents the complete verification result for a label
 */
export interface VerificationResult {
  labelId: string;
  filename: string;
  extractedData: LabelData;
  fieldVerifications: FieldVerification[];
  overallMatch: boolean;
  matchPercentage: number;
  processingTime: number;
  timestamp: string;
}

/**
 * Represents a batch verification result
 */
export interface BatchVerificationResult {
  batchId: string;
  totalLabels: number;
  processedLabels: number;
  results: VerificationResult[];
  batchProcessingTime: number;
  timestamp: string;
}

/**
 * Represents the verification request with application data
 */
export interface VerificationRequest {
  labelId: string;
  filename: string;
  imageBase64: string;
  applicationData: LabelData;
}

/**
 * Represents a batch verification request
 */
export interface BatchVerificationRequest {
  batchId: string;
  labels: VerificationRequest[];
}
