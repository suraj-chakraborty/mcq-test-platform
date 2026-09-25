export interface DocumentChunk {
  index: number;
  totalChunks: number;
  title: string;
  startPage: number;
  endPage: number;
  text: string;
  charCount: number;
}

export interface ChunkDistributionItem {
  chunkIndex: number;
  title: string;
  pageRange: [number, number];
  questionsGenerated: number;
}

export interface CoverageReport {
  totalPages: number;
  totalChunks: number;
  coveredPages: number[];
  coveragePercentage: number;
  chunkDistribution: ChunkDistributionItem[];
  isBalanced: boolean;
}

const DEFAULT_TARGET_CHUNK_CHARS = 14000;
const DEFAULT_OVERLAP_CHARS = 400;

/**
 * Extracts page number from a string or [Page X] marker
 */
function extractPageNumber(str: string): number | null {
  const match = str.match(/\[Page\s+(\d+)\]/i) || str.match(/\b(?:page|p\.?)\s*(\d+)\b/i);
  return match ? parseInt(match[1], 10) : null;
}

/**
 * Splits extracted document text into logical, section-aware chunks
 * preserving heading hierarchy, page boundaries, and overlap context.
 */
export function chunkDocumentSectionAware(
  text: string,
  options: {
    targetChunkChars?: number;
    overlapChars?: number;
    totalPages?: number;
  } = {}
): DocumentChunk[] {
  const targetChars = options.targetChunkChars || DEFAULT_TARGET_CHUNK_CHARS;
  const overlap = options.overlapChars || DEFAULT_OVERLAP_CHARS;

  if (!text || text.trim().length === 0) {
    return [];
  }

  // If text is smaller than target chunk size, return single chunk
  if (text.length <= targetChars * 1.2) {
    const startPage = extractPageNumber(text.slice(0, 500)) || 1;
    const endPage = extractPageNumber(text.slice(-500)) || options.totalPages || startPage;

    return [
      {
        index: 0,
        totalChunks: 1,
        title: 'Full Document Context',
        startPage,
        endPage,
        text,
        charCount: text.length,
      },
    ];
  }

  // Split on page markers or major headings
  // Regex matches [Page X] or Chapter/Section headings
  const boundaryRegex = /(?:\n\s*\[Page\s+(\d+)\])|(?:\n\s*(?:Chapter|Section|Unit|Module|Part)\s+[0-9IVXLCDM]+[^\n]*)|(?:\n\s*#{1,3}\s+[^\n]+)/gi;

  const sections: { title: string; text: string; pageNum: number }[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let currentPage = 1;
  let currentTitle = 'Introduction / Section 1';

  while ((match = boundaryRegex.exec(text)) !== null) {
    const matchIndex = match.index;
    const matchedText = match[0].trim();

    if (matchIndex > lastIndex) {
      const sectionText = text.slice(lastIndex, matchIndex).trim();
      if (sectionText.length > 0) {
        sections.push({
          title: currentTitle,
          text: sectionText,
          pageNum: currentPage,
        });
      }
    }

    // Update current title and page for the next section
    if (match[1]) {
      currentPage = parseInt(match[1], 10);
    }
    currentTitle = matchedText.replace(/^\[Page\s+\d+\]\s*/i, '') || `Page ${currentPage}`;
    lastIndex = matchIndex;
  }

  // Push remaining tail section
  if (lastIndex < text.length) {
    const remainingText = text.slice(lastIndex).trim();
    if (remainingText.length > 0) {
      sections.push({
        title: currentTitle,
        text: remainingText,
        pageNum: currentPage,
      });
    }
  }

  // If boundary regex did not yield useful sections, fall back to paragraph grouping
  if (sections.length <= 1) {
    return fallbackParagraphChunking(text, targetChars, overlap, options.totalPages);
  }

  // Aggregate sections into target-sized chunks
  const chunks: DocumentChunk[] = [];
  let currentChunkText = '';
  let chunkStartPage = sections[0].pageNum;
  let chunkEndPage = sections[0].pageNum;
  let chunkTitle = sections[0].title;

  for (let i = 0; i < sections.length; i++) {
    const sec = sections[i];
    const candidateText = currentChunkText ? `${currentChunkText}\n\n${sec.text}` : sec.text;

    if (candidateText.length > targetChars && currentChunkText.length >= targetChars * 0.6) {
      // Finalize current chunk
      chunks.push({
        index: chunks.length,
        totalChunks: 0, // Filled in after loop
        title: chunkTitle,
        startPage: chunkStartPage,
        endPage: chunkEndPage,
        text: currentChunkText,
        charCount: currentChunkText.length,
      });

      // Start new chunk with overlap tail from previous chunk
      const overlapTail = currentChunkText.slice(-overlap);
      currentChunkText = `${overlapTail}\n\n${sec.text}`;
      chunkStartPage = sec.pageNum;
      chunkEndPage = sec.pageNum;
      chunkTitle = sec.title;
    } else {
      currentChunkText = candidateText;
      chunkEndPage = Math.max(chunkEndPage, sec.pageNum);
    }
  }

  if (currentChunkText.trim().length > 0) {
    chunks.push({
      index: chunks.length,
      totalChunks: 0,
      title: chunkTitle,
      startPage: chunkStartPage,
      endPage: chunkEndPage,
      text: currentChunkText,
      charCount: currentChunkText.length,
    });
  }

  // Update totalChunks on each chunk item
  const total = chunks.length;
  for (const c of chunks) {
    c.totalChunks = total;
  }

  return chunks;
}

/**
 * Fallback chunker when document has no explicit headings or page markers.
 */
function fallbackParagraphChunking(
  text: string,
  targetChars: number,
  overlap: number,
  totalPages?: number
): DocumentChunk[] {
  const paragraphs = text.split(/\n\s*\n/);
  const chunks: DocumentChunk[] = [];
  let currentText = '';
  let chunkIndex = 0;

  for (const p of paragraphs) {
    if ((currentText + '\n\n' + p).length > targetChars && currentText.length > 0) {
      const overlapTail = currentText.slice(-overlap);
      chunks.push({
        index: chunkIndex++,
        totalChunks: 0,
        title: `Section ${chunkIndex}`,
        startPage: 1,
        endPage: totalPages || 1,
        text: currentText.trim(),
        charCount: currentText.trim().length,
      });
      currentText = overlapTail + '\n\n' + p;
    } else {
      currentText += (currentText ? '\n\n' : '') + p;
    }
  }

  if (currentText.trim().length > 0) {
    chunks.push({
      index: chunkIndex++,
      totalChunks: 0,
      title: `Section ${chunkIndex}`,
      startPage: 1,
      endPage: totalPages || 1,
      text: currentText.trim(),
      charCount: currentText.trim().length,
    });
  }

  for (const c of chunks) {
    c.totalChunks = chunks.length;
  }

  return chunks;
}

/**
 * Calculates syllabus coverage across document pages and chunk distribution.
 */
export function calculateMultiPageCoverage(
  chunks: DocumentChunk[],
  totalPages: number,
  questions: { pageReference?: string; chunkIndex?: number }[]
): CoverageReport {
  const coveredPagesSet = new Set<number>();
  const chunkQuestionCounts = new Map<number, number>();

  for (const q of questions) {
    // 1. Try to parse specific page reference
    if (q.pageReference) {
      const pageNum = extractPageNumber(q.pageReference);
      if (pageNum && pageNum >= 1 && pageNum <= totalPages) {
        coveredPagesSet.add(pageNum);
      }
    }

    // 2. Track chunk distribution
    if (typeof q.chunkIndex === 'number' && chunks[q.chunkIndex]) {
      chunkQuestionCounts.set(q.chunkIndex, (chunkQuestionCounts.get(q.chunkIndex) || 0) + 1);
      // Mark start and end pages of the chunk as covered
      const ch = chunks[q.chunkIndex];
      for (let p = ch.startPage; p <= ch.endPage; p++) {
        coveredPagesSet.add(p);
      }
    }
  }

  const coveredPages = Array.from(coveredPagesSet).sort((a, b) => a - b);
  const effectiveTotalPages = Math.max(1, totalPages);
  const coveragePercentage = Math.min(100, Math.round((coveredPages.length / effectiveTotalPages) * 100));

  const chunkDistribution: ChunkDistributionItem[] = chunks.map((c) => ({
    chunkIndex: c.index,
    title: c.title,
    pageRange: [c.startPage, c.endPage],
    questionsGenerated: chunkQuestionCounts.get(c.index) || 0,
  }));

  // A generation is considered balanced if at least 60% of chunks contributed questions
  const activeChunks = chunkDistribution.filter((c) => c.questionsGenerated > 0).length;
  const isBalanced = chunks.length <= 1 || activeChunks >= Math.ceil(chunks.length * 0.6);

  return {
    totalPages: effectiveTotalPages,
    totalChunks: chunks.length,
    coveredPages,
    coveragePercentage,
    chunkDistribution,
    isBalanced,
  };
}
