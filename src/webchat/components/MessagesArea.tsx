/*
 *  ThunderAI [https://micz.it/thunderbird-addon-thunderai/]
 *  Copyright (C) 2024 - 2026  Mic (m@micz.it)
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU General Public License as published by
 *  the Free Software Foundation, either version 3 of the License, or
 *  (at your option) any later version.
 */

import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import type { Message, PromptData } from "../lib/types";
import { DiffViewer } from "./DiffViewer";

interface MessagesAreaProps {
  messages: Message[];
  llmName: string;
  isCopilot?: boolean;
}

interface DiffViewerEntry {
  id: string;
  originalText: string;
  newText: string;
}

function removeAloneBRs(htmlString: string): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlString, "text/html");
  const brElements = Array.from(doc.querySelectorAll("br"));
  brElements.forEach((br) => {
    let current: Element = br;
    let isInsideP = false;
    while (current.parentElement) {
      if (current.parentElement.tagName.toLowerCase() === "p") {
        isInsideP = true;
        break;
      }
      current = current.parentElement;
    }
    if (!isInsideP) {
      br.remove();
    }
  });
  return doc.body.innerHTML;
}

function getCurrentSelectionHTML(): string {
  const selection = window.getSelection();
  if (selection && selection.rangeCount > 0) {
    const range = selection.getRangeAt(0);
    const container = document.createElement("div");
    container.appendChild(range.cloneContents());
    return container.innerHTML;
  }
  return "";
}

interface ActionButtonsProps {
  promptData: PromptData;
  fullTextHTML: string;
  onDiffView: (originalText: string, newText: string) => void;
  isCopilot?: boolean;
}

function ActionButtons({ promptData, fullTextHTML, onDiffView, isCopilot }: ActionButtonsProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [replyTypePref, setReplyTypePref] = useState<string>("reply_all");
  const [diffShown, setDiffShown] = useState(false);
  const splitRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    browser.storage.sync
      .get({ reply_type: "reply_all" })
      .then((prefs) => {
        if (typeof prefs["reply_type"] === "string") {
          setReplyTypePref(prefs["reply_type"]);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!dropdownOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (splitRef.current && !splitRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    window.addEventListener("click", handleClick);
    return () => window.removeEventListener("click", handleClick);
  }, [dropdownOpen]);

  const getFullText = (): string => {
    let finalText = removeAloneBRs(
      fullTextHTML.trim().replace(/^"|"$/g, "").replace(/^<p>&quot;/, "<p>").replace(/&quot;<\/p>$/, "</p>")
    );
    const selectedHTML = getCurrentSelectionHTML();
    if (selectedHTML !== "") {
      finalText = removeAloneBRs(selectedHTML);
    }
    return finalText;
  };

  const handleUseThisAnswer = async (replyType: string) => {
    const data = { ...promptData };
    if (data.mailMessageId === -1) {
      data.action = "2";
    }
    const finalText = getFullText();
    if (data.action === "1") {
      await browser.runtime.sendMessage({
        command: "chatgpt_replyMessage",
        text: finalText,
        tabId: data.tabId,
        mailMessageId: data.mailMessageId,
        replyType,
      });
      if (!isCopilot) {
        const win = await browser.windows.getCurrent();
        browser.runtime.sendMessage({ command: "chatgpt_close", window_id: win.id }).catch(() => {});
      }
    } else if (data.action === "2") {
      await browser.runtime.sendMessage({
        command: "chatgpt_replaceSelectedText",
        text: finalText,
        tabId: data.tabId,
        mailMessageId: data.mailMessageId,
      });
      if (!isCopilot) {
        const win = await browser.windows.getCurrent();
        browser.runtime.sendMessage({ command: "chatgpt_close", window_id: win.id }).catch(() => {});
      }
    }
  };

  const handleClose = async () => {
    if (isCopilot) return;
    const win = await browser.windows.getCurrent();
    browser.runtime.sendMessage({ command: "chatgpt_close", window_id: win.id }).catch(() => {});
  };

  const handleDiffView = () => {
    const strippedText = fullTextHTML
      .trim()
      .replace(/^"|"$/g, "")
      .replace(/^<p>&quot;/, "<p>")
      .replace(/&quot;<\/p>$/, "</p>")
      .replace(/<\/?[^>]+(>|$)/g, "");

    let originalText = promptData.prompt_info?.selection_text ?? "";
    if (!originalText) {
      originalText = promptData.prompt_info?.body_text ?? "";
    }
    onDiffView(originalText, strippedText);
    setDiffShown(true);
  };

  const isReply = promptData.action === "1" && promptData.mailMessageId !== -1;
  const altReplyType = replyTypePref === "reply_all" ? "reply_sender" : "reply_all";
  const altReplyLabel =
    replyTypePref === "reply_all"
      ? browser.i18n.getMessage("prefs_OptionText_reply_sender")
      : browser.i18n.getMessage("prefs_OptionText_reply_all");
  const mainReplyLabel =
    replyTypePref === "reply_all"
      ? browser.i18n.getMessage("prefs_OptionText_reply_all")
      : browser.i18n.getMessage("prefs_OptionText_reply_sender");

  return (
    <div className="flex flex-wrap gap-[6px] py-[6px] pb-3 self-start">
      {promptData.action !== "0" && (
        <div className="inline-flex relative" ref={splitRef}>
          {isReply ? (
            <>
              <button
                className="inline-flex items-center gap-[5px] px-3 py-[5px] text-[12.5px] font-[inherit] cursor-pointer transition-colors duration-75"
                style={{
                  backgroundColor: "#0060df",
                  color: "#ffffff",
                  border: "1px solid #0060df",
                  borderRadius: "20px 0 0 20px",
                  borderRight: "1px solid rgba(255,255,255,0.3)",
                }}
                onClick={() => handleUseThisAnswer(replyTypePref)}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.backgroundColor = "#0050c0";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.backgroundColor = "#0060df";
                }}
              >
                <span>{browser.i18n.getMessage("apiwebchat_use_this_answer")}</span>
                <br />
                <span style={{ fontSize: "0.7em", opacity: 0.8 }}>{mainReplyLabel}</span>
              </button>
              <button
                aria-label="Show options"
                className="flex items-center justify-center w-[30px] p-0 cursor-pointer transition-colors duration-75"
                style={{
                  backgroundColor: "#0060df",
                  color: "#ffffff",
                  border: "1px solid #0060df",
                  borderLeft: "none",
                  borderRadius: "0 20px 20px 0",
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  setDropdownOpen((v) => !v);
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.backgroundColor = "#0050c0";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.backgroundColor = "#0060df";
                }}
              >
                <svg viewBox="0 0 20 20" width="16" height="16" fill="currentColor">
                  <path d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {dropdownOpen && (
                <div
                  className="absolute top-[calc(100%+4px)] right-0 flex flex-col min-w-[160px] z-[1000] overflow-hidden"
                  style={{
                    backgroundColor: "#ffffff",
                    border: "1px solid #d0d0d0",
                    borderRadius: "10px",
                    boxShadow: "0 4px 12px rgba(0,0,0,0.12)",
                  }}
                >
                  <button
                    className="px-[14px] py-[9px] text-left text-[12.5px] cursor-pointer"
                    style={{ border: "none", borderRadius: 0, backgroundColor: "#ffffff", color: "#1a1a1a" }}
                    onClick={() => {
                      setDropdownOpen(false);
                      handleUseThisAnswer(altReplyType).catch(() => {});
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLButtonElement).style.backgroundColor = "#f0f0f0";
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLButtonElement).style.backgroundColor = "#ffffff";
                    }}
                  >
                    {altReplyLabel}
                  </button>
                </div>
              )}
            </>
          ) : (
            <button
              className="inline-flex items-center gap-[5px] text-[12.5px] font-[inherit] cursor-pointer transition-colors duration-75"
              style={{
                backgroundColor: "#0060df",
                color: "#ffffff",
                border: "1px solid #0060df",
                borderRadius: "20px",
                padding: "5px 10px",
                marginRight: "10px",
              }}
              onClick={() => handleUseThisAnswer(replyTypePref)}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.backgroundColor = "#0050c0";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.backgroundColor = "#0060df";
              }}
            >
              {browser.i18n.getMessage("apiwebchat_use_this_answer")}
            </button>
          )}
        </div>
      )}

      {promptData.prompt_info?.use_diff_viewer === "1" && (
        <button
          disabled={diffShown}
          className="inline-flex items-center gap-[5px] px-3 py-[5px] text-[12.5px] font-[inherit] cursor-pointer transition-colors duration-75 disabled:opacity-50 disabled:cursor-default"
          style={{
            backgroundColor: "#ffffff",
            color: "#1a1a1a",
            border: "1px solid #d0d0d0",
            borderRadius: "20px",
          }}
          onClick={handleDiffView}
          onMouseEnter={(e) => {
            if (!diffShown) (e.currentTarget as HTMLButtonElement).style.backgroundColor = "#f0f0f0";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.backgroundColor = "#ffffff";
          }}
        >
          {browser.i18n.getMessage("btn_show_differences")}
        </button>
      )}

      {!isCopilot && (
        <button
          className="inline-flex items-center gap-[5px] px-3 py-[5px] text-[12.5px] font-[inherit] cursor-pointer transition-colors duration-75"
          style={{
            backgroundColor: "#ffffff",
            color: "#666",
            border: "1px solid #d0d0d0",
            borderRadius: "20px",
          }}
          onClick={handleClose}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.backgroundColor = "#f0f0f0";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.backgroundColor = "#ffffff";
          }}
        >
          {browser.i18n.getMessage("chatgpt_win_close")}
        </button>
      )}
    </div>
  );
}

export function MessagesArea({ messages, llmName, isCopilot }: MessagesAreaProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const [diffViewers, setDiffViewers] = useState<DiffViewerEntry[]>([]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "auto" });
  }, [messages, diffViewers]);

  const handleDiffView = (msgId: string, originalText: string, newText: string) => {
    setDiffViewers((prev) => {
      if (prev.some((d) => d.id === msgId)) return prev;
      return [...prev, { id: msgId, originalText, newText }];
    });
  };

  return (
    <div className="flex flex-col flex-1 overflow-y-auto p-4 gap-1 overflow-x-hidden">
      {messages.map((msg) => {
        const isUser = msg.role === "user";
        const isBot = msg.role === "bot";
        const isError = msg.role === "error";
        const isInfo = msg.role === "info";

        const rowAlign = isUser ? "self-end items-end" : "self-start items-start";

        let bubbleBg = "";
        let bubbleColor = "";
        let bubbleStyle: CSSProperties = { borderRadius: "16px" };

        if (isUser) {
          bubbleBg = "#0060df";
          bubbleColor = "#ffffff";
          bubbleStyle = { borderRadius: "16px", borderBottomRightRadius: "4px" };
        } else if (isBot) {
          bubbleBg = "#f0f0f0";
          bubbleColor = "#1a1a1a";
          bubbleStyle = { borderRadius: "16px", borderBottomLeftRadius: "4px" };
        } else if (isError) {
          bubbleBg = "#fde8e8";
          bubbleColor = "#b91c1c";
          bubbleStyle = { borderRadius: "12px" };
        } else if (isInfo) {
          bubbleBg = "#e8f0fe";
          bubbleColor = "#1a4a8a";
          bubbleStyle = { borderRadius: "12px" };
        }

        let label = "";
        if (isUser) {
          label = browser.i18n.getMessage("apiwebchat_you");
        } else if (isBot) {
          label = llmName;
        } else if (isError) {
          label = `${llmName} — ${browser.i18n.getMessage("apiwebchat_error")}`;
        } else if (isInfo) {
          label = browser.i18n.getMessage("apiwebchat_info");
        }

        const diffEntry = diffViewers.find((d) => d.id === msg.id);

        return (
          <div key={msg.id}>
            <div className={`flex flex-col max-w-[82%] gap-[3px] ${rowAlign}`}>
              <div className="text-[0.7rem] font-semibold tracking-[0.04em] uppercase text-[#888] px-1 mb-[1px]">
                {label}
              </div>
              <div
                className={`px-[14px] py-[10px] text-[13.5px] leading-[1.55] break-words message-content${isInfo ? " text-[0.82em]" : ""}`}
                style={{ backgroundColor: bubbleBg, color: bubbleColor, ...bubbleStyle }}
              >
                {isBot ? (
                  <div dangerouslySetInnerHTML={{ __html: msg.content }} />
                ) : isInfo ? (
                  <div dangerouslySetInnerHTML={{ __html: msg.content.replace(/\n/g, "<br>") }} />
                ) : (
                  <span>{msg.content}</span>
                )}
              </div>

              {msg.showActionButtons && msg.promptData && (
                <ActionButtons
                  promptData={msg.promptData}
                  fullTextHTML={msg.content}
                  onDiffView={(orig, next) => handleDiffView(msg.id, orig, next)}
                  isCopilot={isCopilot ?? false}
                />
              )}
            </div>

            {diffEntry && (
              <div className="mt-2">
                <DiffViewer
                  originalText={diffEntry.originalText}
                  newText={diffEntry.newText}
                  llmName={llmName}
                />
                <div className="h-2" />
              </div>
            )}

            {msg.showActionButtons && <div className="h-2" />}
          </div>
        );
      })}
      <div ref={bottomRef} />
    </div>
  );
}
