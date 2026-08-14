'use client';

import React from 'react';

const toRoman = (num: number) => {
  const map: { [key: number]: string } = {
    1: 'I', 2: 'II', 3: 'III', 4: 'IV', 5: 'V',
    6: 'VI', 7: 'VII', 8: 'VIII', 9: 'IX', 10: 'X',
  };
  return map[num] || num.toString();
};

export function FormattedHeader({ text, isAttempt = false }: { text: string; isAttempt?: boolean }) {
  if (!text) return null;

  const lowerText = text.toLowerCase();

  // 1. MATCHING PATTERN (2-Column Grid)
  // Only trigger if text contains structured List I and List II headers separated by newlines or bold markers
  const hasListI = /(?:\*\*List\s+I[:]*\*\*|\bList\s+I\s*[:\n])/i.test(text);
  const hasListII = /(?:\*\*List\s+II[:]*\*\*|\bList\s+II\s*[:\n])/i.test(text);

  if (hasListI && hasListII) {
    const parts = text.split(/(?:\*\*List\s+I[:]*\*\*|\bList\s+I\s*[:]*|\*\*List\s+II[:]*\*\*|\bList\s+II\s*[:]*)/gi);
    if (parts.length >= 3) {
      const intro = (parts[0] || '').trim();
      const list1Raw = (parts[1] || '').trim();
      const list2Raw = (parts[2] || '').trim();
      const conclusion = (parts[3] || '').trim();

      const l1Items = list1Raw
        .split(/(?:^|\n)\s*(?=[A-D1-4][\.\)]\s*)/)
        .filter((x) => x.trim().length > 2)
        .map((x) => x.replace(/^[A-D1-4][\.\)]\s*/, '').trim());

      const l2Items = list2Raw
        .split(/(?:^|\n)\s*(?=[A-D1-4][\.\)]\s*)/)
        .filter((x) => x.trim().length > 2)
        .map((x) => x.replace(/^[A-D1-4][\.\)]\s*/, '').trim());

      // Only render grid if BOTH lists have at least 2 valid, distinct items
      if (l1Items.length >= 2 && l2Items.length >= 2) {
        const length = Math.max(l1Items.length, l2Items.length);
        const rows = Array.from({ length }, (_, i) => ({
          l1: l1Items[i] || '',
          l2: l2Items[i] || '',
        }));

        return (
          <div className="space-y-6 w-full">
            {intro && <div className="leading-relaxed text-gray-800 font-medium">{intro}</div>}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-gray-50/70 p-4 sm:p-6 rounded-3xl border border-gray-100 shadow-inner">
              <div className="space-y-3">
                <div className="text-[10px] font-black uppercase tracking-[0.2em] text-[#4f46e5]/60 px-2">List I</div>
                {rows.map((row, i) => (
                  <div
                    key={i}
                    className="min-h-[44px] flex items-center bg-white p-3.5 rounded-2xl border border-gray-100/80 shadow-sm gap-3 transition-all"
                  >
                    <span className="shrink-0 w-6 h-6 flex items-center justify-center bg-indigo-50 rounded-lg text-[#4f46e5] font-black text-xs">
                      {String.fromCharCode(65 + i)}
                    </span>
                    <span className="text-[13.5px] font-bold text-gray-700 leading-snug">{row.l1}</span>
                  </div>
                ))}
              </div>
              <div className="space-y-3">
                <div className="text-[10px] font-black uppercase tracking-[0.2em] text-[#4f46e5]/60 px-2">List II</div>
                {rows.map((row, i) => (
                  <div
                    key={i}
                    className="min-h-[44px] flex items-center bg-white p-3.5 rounded-2xl border border-gray-100/80 shadow-sm gap-3 transition-all"
                  >
                    <span className="shrink-0 w-6 h-6 flex items-center justify-center bg-gray-50 rounded-lg text-gray-500 font-black text-xs">
                      {i + 1}
                    </span>
                    <span className="text-[13.5px] font-bold text-gray-700 leading-snug">{row.l2}</span>
                  </div>
                ))}
              </div>
            </div>
            {conclusion && (
              <div className="leading-relaxed text-gray-800 font-bold border-t border-gray-50 pt-4">{conclusion}</div>
            )}
          </div>
        );
      }
    }
  }

  // 2. STATEMENT PATTERN (Vertical Stack)
  const hasStatements = /(?:\*\*Statement\s+[IVX1-9]+|\bStatement\s+[IVX1-9]+\s*[:])/i.test(text);
  if (hasStatements) {
    const parts = text.split(/(?=(?:\*\*)*Statement\s+[IVX1-9]+)/gi);
    const intro = (parts[0] || '').trim();
    const statementItems = parts.slice(1);

    const processed = statementItems
      .map((item) => {
        const cleaned = item.replace(/^(\*\*)?Statement\s+[IVX1-9]+(\*\*)*\s*[:]*\s*/i, '').trim();
        return cleaned;
      })
      .filter((item) => item.length > 5);

    let finalPart = '';
    if (processed.length >= 2) {
      const lastItem = processed[processed.length - 1];
      const conclusionSplit = lastItem.split(/(?=\?|Which of the|Select the|Choose the)/i);
      if (conclusionSplit.length > 1) {
        processed[processed.length - 1] = conclusionSplit[0].trim();
        finalPart = conclusionSplit.slice(1).join('').trim();
      }

      return (
        <div className="space-y-6 w-full">
          {intro && <div className="leading-relaxed text-gray-800 font-medium">{intro}</div>}
          <div className="space-y-3">
            {processed.map((item, i) => (
              <div
                key={i}
                className="p-4 sm:p-5 bg-white border border-gray-100 rounded-2xl shadow-sm flex gap-4 transition-all hover:shadow-md hover:border-indigo-100 group"
              >
                <div className="shrink-0 w-8 h-8 rounded-xl bg-indigo-50 flex items-center justify-center text-[#4f46e5] font-black text-xs group-hover:bg-[#4f46e5] group-hover:text-white transition-colors">
                  {toRoman(i + 1)}
                </div>
                <div className="text-[14.5px] font-bold text-gray-800 leading-relaxed pt-0.5">
                  {item.split(/(\*\*.*?\*\*)/g).map((sub, j) =>
                    sub.startsWith('**') && sub.endsWith('**') ? (
                      <strong key={j} className="text-[#4f46e5] font-black">
                        {sub.slice(2, -2)}
                      </strong>
                    ) : (
                      sub
                    )
                  )}
                </div>
              </div>
            ))}
          </div>
          {finalPart && (
            <div className="leading-relaxed text-gray-900 font-black text-base pt-3 border-t border-gray-100">
              {finalPart}
            </div>
          )}
        </div>
      );
    }
  }

  // 3. ASSERTION-REASON PATTERN
  const hasAssertion = /(?:\*\*Assertion\s*\(A\)|\bAssertion\s*\(A\)\s*[:])/i.test(text);
  const hasReason = /(?:\*\*Reason\s*\(R\)|\bReason\s*\(R\)\s*[:])/i.test(text);

  if (hasAssertion && hasReason) {
    const arParts = text.split(/(?=(?:\*\*)*(?:Assertion\s*\(A\)|Reason\s*\(R\)))/gi);
    const processed = arParts
      .map((part) => {
        const isAsser = part.toLowerCase().includes('assertion');
        const cleanPart = part.replace(/^(\*\*)?(Assertion\s*\(A\)|Reason\s*\(R\))(\*\*)*\s*[:]*\s*/i, '').trim();
        return { isAsser, text: cleanPart };
      })
      .filter((item) => item.text.length > 5);

    if (processed.length >= 2) {
      return (
        <div className="space-y-4 w-full">
          {processed.map((item, i) => (
            <div
              key={i}
              className={
                item.isAsser
                  ? 'p-5 bg-indigo-50/60 rounded-2xl border border-indigo-100 flex flex-col gap-2'
                  : 'p-5 bg-gray-50/70 rounded-2xl border border-gray-100 flex flex-col gap-2'
              }
            >
              <div className="text-[10px] font-black uppercase tracking-widest text-[#4f46e5]/70">
                {item.isAsser ? 'Assertion (A)' : 'Reason (R)'}
              </div>
              <div className="text-[14.5px] leading-relaxed font-bold text-gray-800">
                {item.text.split(/(\*\*.*?\*\*)/g).map((sub, j) =>
                  sub.startsWith('**') && sub.endsWith('**') ? (
                    <strong key={j} className="text-[#4f46e5] font-black">
                      {sub.slice(2, -2)}
                    </strong>
                  ) : (
                    sub
                  )
                )}
              </div>
            </div>
          ))}
        </div>
      );
    }
  }

  // 4. FALLBACK: Clean Standard Markdown & Paragraph Formatter
  return (
    <div className="whitespace-pre-line leading-relaxed font-bold text-gray-800 text-[15px]">
      {text.split(/(\*\*.*?\*\*)/g).map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          const isHeader = /Statement|List|Assertion|Reason|Scenario|Passage/i.test(part);
          return (
            <span key={i}>
              {isHeader && i > 0 && <br />}
              <strong className={isAttempt ? 'text-[#4f46e5] font-black' : 'text-gray-900 font-black'}>
                {part.slice(2, -2)}
              </strong>
            </span>
          );
        }
        return part;
      })}
    </div>
  );
}
