/**
 * Frontend types for label verification
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
}

export interface GovernmentWarningSubResult {
  check: 'presence' | 'format' | 'textAccuracy';
  passed: boolean;
  details: string;
}

export interface WarningFormatAttributes {
  isBold: boolean | null;
  relativeFontSize: string | null;
  isAllCaps: boolean | null;
}

export interface GovernmentWarningResult {
  subResults: GovernmentWarningSubResult[];
  formatAttributes: WarningFormatAttributes | null;
  overallPass: boolean;
}

export interface FieldVerification {
  fieldName: string;
  expectedValue?: string;
  extractedValue?: string;
  isMatch: boolean;
  confidence: number;
  notes?: string;
  governmentWarningResult?: GovernmentWarningResult;
}

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

export interface BatchVerificationResult {
  batchId: string;
  totalLabels: number;
  processedLabels: number;
  results: VerificationResult[];
  batchProcessingTime: number;
  timestamp: string;
}

export interface UploadStatus {
  filename: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  error?: string;
}

export interface BatchRowResult extends VerificationResult {
  status: 'pass' | 'fail' | 'needs-review';
  error?: string;
}

export interface BatchSummary {
  total: number;
  passed: number;
  failed: number;
  needsReview: number;
  results: BatchRowResult[];
}
