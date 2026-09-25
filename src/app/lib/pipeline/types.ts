export const JOB_STATUSES = {
  QUEUED: 'QUEUED',
  UPLOADED: 'UPLOADED',
  VALIDATING: 'VALIDATING',
  EXTRACTING: 'EXTRACTING',
  OCR: 'OCR',
  CHUNKING: 'CHUNKING',
  GENERATING: 'GENERATING',
  VERIFYING: 'VERIFYING',
  FINALIZING: 'FINALIZING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED',
} as const;

export type JobStatus = (typeof JOB_STATUSES)[keyof typeof JOB_STATUSES];

export const ERROR_CODES = {
  ENCRYPTED: 'ENCRYPTED',
  CORRUPT: 'CORRUPT',
  SCANNED: 'SCANNED',
  EMPTY: 'EMPTY',
  TOO_LARGE: 'TOO_LARGE',
  ACTIVE_CONTENT: 'ACTIVE_CONTENT',
  TIMEOUT: 'TIMEOUT',
  LLM_ERROR: 'LLM_ERROR',
  UNAUTHORIZED: 'UNAUTHORIZED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

export type JobErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

export interface PageExtractionResult {
  pageNumber: number;
  text: string;
  charCount: number;
  isLowDensity: boolean; // < 50 chars, candidate for OCR
}

export interface ExtractedDocumentResult {
  sha256: string;
  text: string;
  pageCount: number;
  pages: PageExtractionResult[];
  isScanned: boolean; // whole doc has 0 or negligible text
  needsOcr: boolean;  // some or all pages require OCR
  lowDensityPages: number[];
  wasCacheHit: boolean;
}

export interface SanitizationResult {
  buffer: Buffer;
  sha256: string;
  hasActiveContent: boolean;
  neutralizedThreats: string[];
  isValidPdf: boolean;
}

export interface EnqueueJobPayload {
  userId: string;
  type?: string;
  idempotencyKey?: string;
  title: string;
  topic?: string;
  numQuestions?: number;
  contextPDFs: {
    name: string;
    url?: string;
    publicId?: string;
    bufferBase64?: string;
    fileSize?: number;
    text?: string;
    pageCount?: number;
    sha256?: string;
  }[];
  pyqPDFs?: {
    name: string;
    url?: string;
    publicId?: string;
    bufferBase64?: string;
    fileSize?: number;
    text?: string;
    pageCount?: number;
    sha256?: string;
  }[];
  metadata?: Record<string, any>;
}

export interface JobStateUpdate {
  status: JobStatus;
  progress: number;
  currentStep: number;
  totalSteps?: number;
  stage?: string;
  error?: string;
  errorCode?: JobErrorCode;
  testId?: string;
}
