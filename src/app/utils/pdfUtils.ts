import pdfParse from 'pdf-parse';

export interface ExtractedPdfData {
  text: string;
  pageCount: number;
  isScanned: boolean;
  rawBuffer: Buffer;
}

export async function extractTextFromPdf(buffer: Buffer): Promise<ExtractedPdfData> {
  try {
    const data = await pdfParse(buffer);
    const rawText = data.text ? data.text.trim() : '';
    const pageCount = data.numpages || 1;

    // Detect if the document is scanned or lacks a text layer
    const isScanned = rawText.length < 50;

    return {
      text: rawText,
      pageCount,
      isScanned,
      rawBuffer: buffer,
    };
  } catch (error) {
    console.warn('pdf-parse encountered an error, falling back to direct multimodal vision processing:', error);
    return {
      text: '',
      pageCount: 1,
      isScanned: true,
      rawBuffer: buffer,
    };
  }
}

export function splitTextIntoSections(text: string, maxChunkLength = 12000): string[] {
  if (text.length <= maxChunkLength) {
    return [text];
  }

  const paragraphs = text.split(/\n\s*\n/);
  const chunks: string[] = [];
  let currentChunk = '';

  for (const para of paragraphs) {
    if ((currentChunk + '\n\n' + para).length > maxChunkLength) {
      if (currentChunk) chunks.push(currentChunk.trim());
      currentChunk = para;
    } else {
      currentChunk += (currentChunk ? '\n\n' : '') + para;
    }
  }

  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}