'use client';

import React from 'react';

const toRoman = (num: number) => {
    const map: { [key: number]: string } = { 1: 'I', 2: 'II', 3: 'III', 4: 'IV', 5: 'V', 6: 'VI', 7: 'VII', 8: 'VIII', 9: 'IX', 10: 'X' };
    return map[num] || num.toString();
};

export function FormattedHeader({ text, isAttempt = false }: { text: string; isAttempt?: boolean }) {
  const lowerText = text.toLowerCase();
  
  // 1. MATCHING PATTERN (2-Column Grid)
  const isMatching = lowerText.includes('list i') && lowerText.includes('list ii');
  
  if (isMatching) {
    const parts = text.split(/\*\*List I[:]*\*\*|List I[:]*|\*\*List II[:]*\*\*|List II[:]*/gi);
    const intro = (parts[0] || "").trim();
    const list1Raw = (parts[1] || "").trim();
    const list2Raw = (parts[2] || "").trim();
    const conclusion = (parts[3] || "").trim();

    const l1Items = list1Raw.split(/(?:^|\n)(?=[A-D][\.\)]\s*)/).filter(x => x.trim()).map(x => x.trim());
    const l2Items = list2Raw.split(/(?:^|\n)(?=[1-4][\.\)]\s*)/).filter(x => x.trim()).map(x => x.trim());

    const cleanL1 = l1Items.map(item => item.replace(/^[A-D][\.\)]\s*/, '').trim());
    const cleanL2 = l2Items.map(item => item.replace(/^[1-4][\.\)]\s*/, '').trim());

    if (cleanL1.length > 0 && cleanL2.length > 0) {
      const length = Math.max(cleanL1.length, cleanL2.length);
      const rows = Array.from({ length }, (_, i) => ({
        l1: cleanL1[i] || "",
        l2: cleanL2[i] || ""
      }));

      return (
        <div className="space-y-6 w-full">
          <div className="leading-relaxed text-gray-800 font-medium">{intro}</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-gray-50/50 p-4 sm:p-6 rounded-3xl border border-gray-100 shadow-inner">
            <div className="space-y-3">
              <div className="text-[10px] font-black uppercase tracking-[0.2em] text-[#4f46e5]/40 px-4">List I</div>
              {rows.map((row, i) => (
                <div key={i} className="min-h-[44px] flex items-center bg-white p-4 rounded-2xl border border-gray-100/50 shadow-sm gap-4 transition-all hover:border-[#4f46e5]/30">
                  <span className="shrink-0 w-6 h-6 flex items-center justify-center bg-indigo-50 rounded-lg text-[#4f46e5] font-black text-[10px]">{String.fromCharCode(65 + i)}</span>
                  <span className="text-[14px] font-bold text-gray-700 leading-tight">{row.l1}</span>
                </div>
              ))}
            </div>
            <div className="space-y-3">
              <div className="text-[10px] font-black uppercase tracking-[0.2em] text-[#4f46e5]/40 px-4">List II</div>
              {rows.map((row, i) => (
                <div key={i} className="min-h-[44px] flex items-center bg-white p-4 rounded-2xl border border-gray-100/50 shadow-sm gap-4 transition-all hover:border-[#4f46e5]/30">
                  <span className="shrink-0 w-6 h-6 flex items-center justify-center bg-gray-50 rounded-lg text-gray-400 font-black text-[10px]">{i + 1}</span>
                  <span className="text-[14px] font-bold text-gray-700 leading-tight">{row.l2}</span>
                </div>
              ))}
            </div>
          </div>
          {conclusion && <div className="leading-relaxed text-gray-800 font-bold border-t border-gray-50 pt-4">{conclusion}</div>}
        </div>
      );
    }
  }

  // 2. STATEMENT PATTERN (Vertical Stack)
  const isStatements = lowerText.includes('statement i');
  if (isStatements) {
    const parts = text.split(/(?=(?:\*\*)*Statement\s+[IVX]+)/gi);
    const intro = (parts[0] || "").trim();
    
    const statementItems = parts.slice(1);
    const processed = statementItems.map(item => {
        const cleaned = item.replace(/^(\*\*)?Statement\s+[IVX]+(\*\*)*\s*[:]*\s*/i, '').trim();
        return cleaned;
    }).filter(item => item.length > 2);

    let finalPart = "";
    if (processed.length > 0) {
        const lastItem = processed[processed.length - 1];
        const conclusionSplit = lastItem.split(/(?=\?|Which of the|Select the)/i);
        if (conclusionSplit.length > 1) {
            processed[processed.length - 1] = conclusionSplit[0].trim();
            finalPart = conclusionSplit.slice(1).join("").trim();
        }
    }

    if (processed.length > 0) {
      return (
        <div className="space-y-6 w-full">
          <div className="leading-relaxed text-gray-800 font-medium">{intro}</div>
          <div className="space-y-3">
            {processed.map((item, i) => (
              <div key={i} className="p-5 bg-white border border-gray-100 rounded-2xl shadow-sm flex gap-4 transition-all hover:shadow-md hover:border-indigo-100 group">
                 <div className="shrink-0 w-8 h-8 rounded-xl bg-indigo-50 flex items-center justify-center text-[#4f46e5] font-black text-[10px] group-hover:bg-[#4f46e5] group-hover:text-white transition-colors">
                    { toRoman(i + 1) }
                 </div>
                 <div className="text-[15px] font-bold text-gray-800 leading-relaxed pt-1">
                    {item.split(/(\*\*.*?\*\*)/g).map((sub, j) => 
                      (sub.startsWith('**') && sub.endsWith('**')) ? <strong key={j} className="text-[#4f46e5] font-black">{sub.slice(2, -2)}</strong> : sub
                    )}
                 </div>
              </div>
            ))}
          </div>
          {finalPart && <div className="leading-relaxed text-gray-900 font-black text-lg pt-4 border-t border-gray-50">{finalPart}</div>}
        </div>
      );
    }
  }

  // 3. ASSERTION-REASON PATTERN
  const isAssertion = lowerText.includes('assertion (a)') || lowerText.includes('reason (r)');
  if (isAssertion) {
     const arParts = text.split(/(?=(?:\*\*)*(?:Assertion\s*\(A\)|Reason\s*\(R\)))/gi);
     const processed = arParts.map(part => {
        const isAsser = part.toLowerCase().includes('assertion');
        const cleanPart = part.replace(/^(\*\*)?(Assertion\s*\(A\)|Reason\s*\(R\))(\*\*)*\s*[:]*\s*/i, '').trim();
        return { isAsser, text: cleanPart };
     }).filter(item => item.text.length > 2);

     if (processed.length > 0) {
       return (
          <div className="space-y-4">
             {processed.map((item, i) => (
                <div key={i} className={item.isAsser ? "p-6 bg-indigo-50/50 rounded-3xl border border-indigo-100 flex flex-col gap-3" : "p-6 bg-gray-50/50 rounded-3xl border border-gray-100 flex flex-col gap-3"}>
                   <div className="text-[10px] font-black uppercase tracking-widest text-[#4f46e5]/60">
                      {item.isAsser ? "Assertion (A)" : "Reason (R)"}
                   </div>
                   <div className="text-[15px] leading-relaxed font-bold text-gray-800">
                      {item.text.split(/(\*\*.*?\*\*)/g).map((sub, j) => 
                        (sub.startsWith('**') && sub.endsWith('**')) ? <strong key={j} className="text-[#4f46e5] font-black">{sub.slice(2, -2)}</strong> : sub
                      )}
                   </div>
                </div>
             ))}
          </div>
       );
     }
  }

  // 4. FALLBACK: Standard Renderer
  return (
    <div className="whitespace-pre-line leading-relaxed font-bold text-gray-800">
      {text.split(/(\*\*.*?\*\*)/g).map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          const isHeader = /Statement|List|Assertion|Reason|Scenario|Passage/i.test(part);
          return (
            <span key={i}>
              {isHeader && i > 0 && <br />}
              <strong className={isAttempt ? "text-[#4f46e5] font-black" : "text-gray-900 font-black"}>
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
