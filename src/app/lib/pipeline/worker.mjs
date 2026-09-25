import { parentPort, workerData } from 'worker_threads';

async function parsePdf(bufferData, options = {}) {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');

  const { maxPages = 500 } = options;

  let doc;
  try {
    const loadingTask = pdfjs.getDocument({
      data: new Uint8Array(bufferData),
      isEvalSupported: false,
      useSystemFonts: true,
      stopAtErrors: false,
    });
    doc = await loadingTask.promise;
  } catch (loadErr) {
    const msg = (loadErr?.message || '').toLowerCase();
    const name = loadErr?.name || '';

    if (name === 'PasswordException' || msg.includes('password') || msg.includes('encrypted')) {
      return { error: 'ENCRYPTED', message: 'Document is password protected' };
    }
    if (name === 'InvalidPDFException' || msg.includes('invalid pdf') || msg.includes('corrupt')) {
      return { error: 'CORRUPT', message: 'Document is corrupt or truncated' };
    }
    return { error: 'CORRUPT', message: `Parse failure: ${loadErr?.message}` };
  }

  const numPages = doc.numPages || 0;
  if (numPages === 0) {
    return { error: 'EMPTY', message: 'Document has 0 pages' };
  }

  const effectivePages = Math.min(numPages, maxPages);
  const pages = [];
  const lowDensityPages = [];
  let fullText = '';

  for (let pageNum = 1; pageNum <= effectivePages; pageNum++) {
    try {
      const page = await doc.getPage(pageNum);
      const textContent = await page.getTextContent();
      const pageStrings = [];

      for (const item of textContent.items) {
        if ('str' in item && typeof item.str === 'string') {
          pageStrings.push(item.str);
        }
      }

      const pageText = pageStrings.join(' ').replace(/\s+/g, ' ').trim();
      const charCount = pageText.length;
      const isLowDensity = charCount < 50;

      if (isLowDensity) {
        lowDensityPages.push(pageNum);
      }

      pages.push({
        pageNumber: pageNum,
        text: pageText,
        charCount,
        isLowDensity,
      });

      if (pageText) {
        fullText += (fullText ? '\n\n' : '') + `[Page ${pageNum}]\n` + pageText;
      }
    } catch (pageErr) {
      pages.push({ pageNumber: pageNum, text: '', charCount: 0, isLowDensity: true });
      lowDensityPages.push(pageNum);
    }
  }

  const totalChars = fullText.trim().length;
  const isScanned = totalChars === 0 || (totalChars < 50 && effectivePages > 1);
  const needsOcr = isScanned || lowDensityPages.length > 0;

  return {
    success: true,
    text: fullText,
    pageCount: effectivePages,
    pages,
    isScanned,
    needsOcr,
    lowDensityPages,
  };
}

if (parentPort && workerData) {
  parsePdf(workerData.buffer, workerData.options)
    .then((result) => parentPort.postMessage(result))
    .catch((err) => parentPort.postMessage({ error: 'INTERNAL_ERROR', message: err.message }));
}
