import { JobErrorCode, ERROR_CODES } from './types';
export { ERROR_CODES };
export type { JobErrorCode };

export class PipelineError extends Error {
  public readonly code: JobErrorCode;
  public readonly statusCode: number;
  public readonly userMessage: string;

  constructor(message: string, code: JobErrorCode, statusCode = 400, userMessage?: string) {
    super(message);
    this.name = 'PipelineError';
    this.code = code;
    this.statusCode = statusCode;
    this.userMessage = userMessage || message;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class EncryptedPdfError extends PipelineError {
  constructor(message = 'The uploaded PDF is password-protected or encrypted.') {
    super(
      message,
      ERROR_CODES.ENCRYPTED,
      400,
      'This document is password-protected. Please remove the password and re-upload.'
    );
    this.name = 'EncryptedPdfError';
  }
}

export class CorruptPdfError extends PipelineError {
  constructor(message = 'The uploaded file is corrupt or is not a valid PDF.') {
    super(
      message,
      ERROR_CODES.CORRUPT,
      400,
      'The file could not be parsed. The PDF byte stream appears damaged or truncated.'
    );
    this.name = 'CorruptPdfError';
  }
}

export class ScannedPdfError extends PipelineError {
  constructor(message = 'The PDF contains no digital text layer and requires OCR.') {
    super(
      message,
      ERROR_CODES.SCANNED,
      400,
      'This appears to be a scanned document without a selectable text layer.'
    );
    this.name = 'ScannedPdfError';
  }
}

export class EmptyPdfError extends PipelineError {
  constructor(message = 'The PDF document contains 0 pages or no extractable content.') {
    super(
      message,
      ERROR_CODES.EMPTY,
      400,
      'The document appears to be empty. Please upload a PDF with syllabus content.'
    );
    this.name = 'EmptyPdfError';
  }
}

export class TooLargePdfError extends PipelineError {
  constructor(message = 'The PDF exceeds size or page count limits.') {
    super(
      message,
      ERROR_CODES.TOO_LARGE,
      400,
      'The document exceeds the maximum allowable size or page limit (maximum 50 MB / 500 pages).'
    );
    this.name = 'TooLargePdfError';
  }
}

export class ActiveContentPdfError extends PipelineError {
  constructor(message = 'The PDF contains malicious active content or executable attachments.') {
    super(
      message,
      ERROR_CODES.ACTIVE_CONTENT,
      400,
      'Security alert: The document contains embedded scripts or executable attachments and was rejected.'
    );
    this.name = 'ActiveContentPdfError';
  }
}

export class PipelineTimeoutError extends PipelineError {
  constructor(message = 'Pipeline stage execution timed out.') {
    super(
      message,
      ERROR_CODES.TIMEOUT,
      504,
      'Processing timed out. The system has saved partial progress.'
    );
    this.name = 'PipelineTimeoutError';
  }
}
