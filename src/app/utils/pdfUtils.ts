import pdfParse from 'pdf-parse/lib/pdf-parse';

export async function extractTextFromPdf(buffer: Buffer): Promise<{ text: string, pageCount: number }> {
  const data = await pdfParse(buffer);
  if (!data.text || data.text.length < 50) {
    throw new Error('PDF too short or invalid');
  }
  return { text: data.text, pageCount: data.numpages };
}