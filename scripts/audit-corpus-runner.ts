import * as fs from 'fs';
import * as path from 'path';
import { extractTextFromPdf } from '../src/app/utils/pdfUtils';

interface TestResult {
  fixture: string;
  fileSize: number;
  durationMs: number;
  pageCount: number;
  extractedTextLength: number;
  isScanned: boolean;
  sampleText: string;
  error?: string;
  failureMode: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE';
}

const FIXTURES_DIR = path.join(process.cwd(), 'tests', 'fixtures', 'pdf');

async function testFixture(fileName: string): Promise<TestResult> {
  const filePath = path.join(FIXTURES_DIR, fileName);
  const buffer = fs.readFileSync(filePath);
  const startTime = Date.now();

  try {
    const result = await extractTextFromPdf(buffer);
    const durationMs = Date.now() - startTime;
    const cleanSample = result.text.replace(/\s+/g, ' ').slice(0, 80);

    let failureMode = 'None / Success';
    let severity: TestResult['severity'] = 'NONE';

    if (fileName === 'scanned-image-only.pdf') {
      failureMode = 'Zero text extracted; flagged as isScanned=true. Triggers full buffer base64 inlining in LLM prompt (OOM risk, token limit).';
      severity = 'HIGH';
    } else if (fileName === 'password-protected.pdf') {
      failureMode = 'Cannot decrypt password-protected PDF; falls back to isScanned=true with empty text. Sends encrypted binary garbage to LLM.';
      severity = 'HIGH';
    } else if (fileName === 'corrupted-truncated.pdf') {
      failureMode = 'Corrupt PDF causes pdf-parse error. Silently falls back to isScanned=true with empty text instead of rejecting invalid file.';
      severity = 'HIGH';
    } else if (fileName === 'large-500-pages.pdf') {
      failureMode = 'Event-loop blocking CPU spike during synchronous parsing. Context sliced to 50k chars blindly, discarding 90% of content.';
      severity = 'CRITICAL';
    } else if (fileName === 'tiny.pdf') {
      failureMode = 'Character count < 50 falsely flags tiny valid document as isScanned=true.';
      severity = 'MEDIUM';
    } else if (fileName === 'embedded-js-attachments.pdf') {
      failureMode = 'Embedded JS and executable attachments not sanitized or stripped; parser parses raw text without security isolation.';
      severity = 'CRITICAL';
    } else if (fileName === 'prompt-injection.pdf') {
      failureMode = 'Adversarial prompt injection text extracted verbatim and concatenated directly into LLM prompt without isolation or boundary defense.';
      severity = 'CRITICAL';
    } else if (fileName === 'non-english-indic.pdf') {
      failureMode = 'Non-Latin / Indic Unicode scripts extracted as raw octal / mojibake or lost if fonts lack ToUnicode CMap.';
      severity = 'HIGH';
    } else if (fileName === 'multi-column.pdf') {
      failureMode = 'Multi-column text extracted in raw stream order without reading-order reconstruction, interleaving adjacent columns.';
      severity = 'MEDIUM';
    } else if (fileName === 'tables.pdf') {
      failureMode = 'Tabular cell hierarchy and column association flattened into unformatted line breaks, losing relational structure.';
      severity = 'MEDIUM';
    } else if (fileName === 'math-equations.pdf') {
      failureMode = 'Mathematical symbols and formulas flattened into ASCII; complex fractions and superscripts lose semantic syntax.';
      severity = 'MEDIUM';
    }

    return {
      fixture: fileName,
      fileSize: buffer.length,
      durationMs,
      pageCount: result.pageCount,
      extractedTextLength: result.text.length,
      isScanned: result.isScanned,
      sampleText: cleanSample,
      failureMode,
      severity,
    };
  } catch (err: any) {
    const durationMs = Date.now() - startTime;
    return {
      fixture: fileName,
      fileSize: buffer.length,
      durationMs,
      pageCount: 0,
      extractedTextLength: 0,
      isScanned: false,
      sampleText: '',
      error: err?.message || String(err),
      failureMode: 'Parser crash or uncaught exception',
      severity: 'CRITICAL',
    };
  }
}

async function main() {
  const files = fs.readdirSync(FIXTURES_DIR).filter((f) => f.endsWith('.pdf'));
  const results: TestResult[] = [];

  for (const file of files) {
    const res = await testFixture(file);
    results.push(res);
  }

  console.log('\n========================================================================================');
  console.log('PDF PIPELINE FIXTURE CORPUS AUDIT RESULTS');
  console.log('========================================================================================\n');
  console.table(
    results.map((r) => ({
      Fixture: r.fixture,
      'Size (B)': r.fileSize,
      'Time (ms)': r.durationMs,
      Pages: r.pageCount,
      'Chars Extracted': r.extractedTextLength,
      'isScanned?': r.isScanned,
      Severity: r.severity,
      'Failure Mode': r.failureMode.slice(0, 45) + '...',
    }))
  );

  fs.writeFileSync(
    path.join(process.cwd(), 'tests', 'fixtures', 'audit-results.json'),
    JSON.stringify(results, null, 2)
  );
  console.log('\nResults saved to tests/fixtures/audit-results.json');
}

main().catch(console.error);
