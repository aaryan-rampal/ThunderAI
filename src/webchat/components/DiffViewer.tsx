/*
 *  ThunderAI [https://micz.it/thunderbird-addon-thunderai/]
 *  Copyright (C) 2024 - 2026  Mic (m@micz.it)
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU General Public License as published by
 *  the Free Software Foundation, either version 3 of the License, or
 *  (at your option) any later version.
 */

interface DiffViewerProps {
  originalText: string;
  newText: string;
  llmName: string;
}

interface DiffPart {
  value: string;
  added?: boolean;
  removed?: boolean;
}

export function DiffViewer({ originalText, newText, llmName }: DiffViewerProps) {
  const wordDiff: DiffPart[] = Diff.diffWords(originalText, newText);
  const brRegex = /(<br\s*\/?>)/gi;

  return (
    <div className="flex flex-col max-w-[82%] gap-[3px] self-start items-start">
      <div className="text-[0.7rem] font-semibold tracking-[0.04em] uppercase text-[#888] px-1 mb-[1px]">
        {browser.i18n.getMessage("chatgpt_win_diff_title") || llmName}
      </div>
      <div
        className="px-[14px] py-[10px] rounded-2xl text-[13.5px] leading-[1.55] break-words message-content"
        style={{
          backgroundColor: "#f0f0f0",
          color: "#1a1a1a",
          borderBottomLeftRadius: "4px",
        }}
      >
        {wordDiff.flatMap((part, partIdx) => {
          const segments = part.value.split(brRegex);
          return segments.flatMap((segment, segIdx) => {
            const key = `${partIdx}-${segIdx}`;
            if (segment.match(brRegex)) {
              return [<br key={key} />];
            }
            if (segment.length === 0) {
              return [];
            }
            if (part.added) {
              return [
                <span key={key} className="diff-added">
                  {segment}
                </span>,
              ];
            }
            if (part.removed) {
              return [
                <span key={key} className="diff-removed">
                  {segment}
                </span>,
              ];
            }
            return [<span key={key}>{segment}</span>];
          });
        })}
      </div>
    </div>
  );
}
