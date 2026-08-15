/**
 * Client-side PDF text extractor using pdfjs-dist.
 * Extracts text in the user's browser before sending to Next.js API,
 * eliminating Cloudinary 401 download issues and serverless timeout delays.
 */
export async function extractTextFromPdfClient(
  file: File
): Promise<{ text: string; pageCount: number }> {
  try {
    const pdfjsLib = await import('pdfjs-dist');
    
    // Configure worker
    if (typeof window !== 'undefined' && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
      pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;
    }

    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;
    const numPages = pdf.numPages;

    let fullText = '';
    const maxPages = Math.min(numPages, 100);

    for (let i = 1; i <= maxPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item: any) => item.str || '')
        .join(' ');
      if (pageText.trim()) {
        fullText += `\n--- Page ${i} ---\n${pageText}\n`;
      }
    }

    return {
      text: fullText.trim(),
      pageCount: numPages,
    };
  } catch (err) {
    console.warn('Client-side PDF text extraction failed, server will use fallback:', err);
    return {
      text: '',
      pageCount: 1,
    };
  }
}
