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
import type { CustomTextItem } from "../lib/types";

interface MessageInputProps {
  onSend: (text: string) => void;
  onStop: () => void;
  disabled: boolean;
  sending: boolean;
  model: string;
  statusMessage: string;
  customTextTrigger: CustomTextItem[] | null;
  onCustomTextDone: () => void;
}

export function MessageInput({
  onSend,
  onStop,
  disabled,
  sending,
  model,
  statusMessage,
  customTextTrigger,
  onCustomTextDone,
}: MessageInputProps) {
  const [inputValue, setInputValue] = useState("");
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [customTextArray, setCustomTextArray] = useState<CustomTextItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [customAreaValue, setCustomAreaValue] = useState("");
  const [customLoading, setCustomLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (customTextTrigger !== null) {
      const arr =
        customTextTrigger.length === 0
          ? [{ placeholder: "{%additional_text%}", info: "" }]
          : customTextTrigger;
      setCustomTextArray(arr);
      setCurrentIndex(0);
      setCustomAreaValue("");
      setShowCustomModal(true);
    }
  }, [customTextTrigger]);

  useEffect(() => {
    if (showCustomModal) {
      setCustomAreaValue("");
      setTimeout(() => textareaRef.current?.focus(), 50);
    }
  }, [showCustomModal, currentIndex]);

  useEffect(() => {
    if (!disabled && !sending) {
      inputRef.current?.focus();
    }
  }, [disabled, sending]);

  const handleSend = () => {
    const text = inputValue.trim();
    if (!text) return;
    setInputValue("");
    onSend(text);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleSend();
    }
  };

  const handleCustomNext = async () => {
    const updated = customTextArray.map((item, idx) =>
      idx === currentIndex ? { ...item, custom_text: customAreaValue } : item
    );
    setCustomTextArray(updated);

    if (currentIndex + 1 < updated.length) {
      setCurrentIndex((i) => i + 1);
    } else {
      setCustomLoading(true);
      try {
        const tabs = await browser.tabs.query({ active: true, currentWindow: true });
        await browser.runtime.sendMessage({
          command: "api_send_custom_text",
          custom_text: updated,
          tabId: tabs[0]?.id,
        });
      } finally {
        setCustomLoading(false);
        setShowCustomModal(false);
        onCustomTextDone();
      }
    }
  };

  const handleCustomKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleCustomNext().catch(() => {});
    }
  };

  const currentItem = customTextArray[currentIndex];
  const sendTitle = `${browser.i18n.getMessage("chagpt_api_send_button")}: ${model}`;

  return (
    <>
      <div
        className="flex justify-between items-center px-4 pb-[14px] pt-[10px] gap-2 relative font-[inherit]"
        style={{
          borderTop: "1px solid #e5e5e5",
          backgroundColor: "#ffffff",
        }}
      >
        <style>{`
          @media (prefers-color-scheme: dark) {
            .msg-input-bar {
              background: #1e1e1e !important;
              border-top-color: #3a3a3a !important;
            }
            .msg-input-field {
              background: #2a2a2a !important;
              color: #e8e8e8 !important;
              border-color: #444 !important;
            }
            .msg-input-field:focus {
              border-color: #4a9eff !important;
              background: #2a2a2a !important;
            }
            .msg-stop-btn {
              background: #2a2a2a !important;
              color: #e8e8e8 !important;
            }
            .msg-stop-btn:hover {
              background: #333 !important;
            }
            .msg-status {
              background: #2a2a2a !important;
              color: #ccc !important;
              border-color: #444 !important;
            }
          }
        `}</style>
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled || sending}
          placeholder=""
          autoComplete="off"
          className="msg-input-field flex-grow text-[13.5px] outline-none transition-all duration-100"
          style={{
            padding: "9px 14px",
            fontFamily: "inherit",
            border: "1px solid #d0d0d0",
            borderRadius: "20px",
            background: "#f7f7f7",
            color: "#1a1a1a",
          }}
        />

        {!sending ? (
          <button
            onClick={handleSend}
            disabled={disabled || !inputValue.trim()}
            title={sendTitle}
            className="w-9 h-9 flex-shrink-0 cursor-pointer rounded-full border-none flex items-center justify-center transition-colors duration-75 disabled:cursor-default"
            style={{ backgroundColor: disabled || !inputValue.trim() ? "#ccc" : "#0060df", color: "#ffffff" }}
            onMouseEnter={(e) => {
              if (!disabled && inputValue.trim())
                (e.currentTarget as HTMLButtonElement).style.backgroundColor = "#0050c0";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.backgroundColor =
                disabled || !inputValue.trim() ? "#ccc" : "#0060df";
            }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M7 11L12 6L17 11M12 18V7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        ) : (
          <button
            onClick={onStop}
            title={sendTitle}
            className="msg-stop-btn w-9 h-9 flex-shrink-0 cursor-pointer rounded-full border-none flex items-center justify-center transition-colors duration-75"
            style={{ backgroundColor: "#f0f0f0", color: "#1a1a1a" }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.backgroundColor = "#e0e0e0";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.backgroundColor = "#f0f0f0";
            }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <rect x="6" y="6" width="12" height="12" fill="currentColor" />
            </svg>
          </button>
        )}

        {statusMessage && (
          <div
            className="msg-status text-[0.78rem] absolute bottom-[4em] right-4 flex items-center gap-[5px]"
            style={{
              border: "1px solid #e0e0e0",
              borderRadius: "8px",
              padding: "5px 10px",
              backgroundColor: "#f7f7f7",
              color: "#555",
              boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
            }}
          >
            {sending && (
              <img
                src={browser.runtime.getURL("/images/mzta-loading.svg")}
                alt=""
                style={{ display: "inline", verticalAlign: "middle", width: "14px", height: "14px" }}
              />
            )}
            <span>{statusMessage}</span>
          </div>
        )}
      </div>

      {showCustomModal && currentItem && (
        <div
          className="fixed inset-0 flex items-center justify-center z-50"
          style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
        >
          <div
            className="relative text-center overflow-y-auto overflow-x-hidden"
            style={{
              padding: "16px",
              width: "50%",
              minWidth: "300px",
              maxWidth: "80%",
              maxHeight: "80%",
              borderRadius: "12px",
              backgroundColor: "#2a2a2a",
              color: "#e8e8e8",
              border: "1px solid #444",
              boxSizing: "border-box",
              boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
            }}
          >
            <div className="text-center w-full pb-[10px] text-[14px]">
              {browser.i18n.getMessage("chatgpt_win_custom_text")}
              {currentItem.info && currentItem.info.trim() !== "" && (
                <>
                  <br />
                  <span style={{ fontSize: "0.82em", opacity: 0.7 }}>
                    [{browser.i18n.getMessage("customPrompts_form_label_ID")}: {currentItem.info}]
                  </span>
                </>
              )}
            </div>

            <textarea
              ref={textareaRef}
              rows={5}
              value={customAreaValue}
              onChange={(e) => setCustomAreaValue(e.target.value)}
              onKeyDown={handleCustomKeyDown}
              className="w-full resize-y rounded-[6px] text-[14px] font-[inherit] box-border"
              style={{
                color: "#1a1a1a",
                padding: "8px",
                border: "1px solid #ccc",
              }}
            />

            {customLoading && (
              <img
                src={browser.runtime.getURL("/images/loading.gif")}
                alt="loading"
                className="h-10 inline-block"
              />
            )}

            <button
              disabled={customLoading}
              onClick={() => handleCustomNext().catch(() => {})}
              className="mt-[10px] cursor-pointer font-[inherit] disabled:opacity-50"
              style={{
                padding: "7px 18px",
                borderRadius: "20px",
                border: "none",
                backgroundColor: "#0060df",
                color: "#fff",
                fontSize: "13.5px",
              }}
              onMouseEnter={(e) => {
                if (!customLoading)
                  (e.currentTarget as HTMLButtonElement).style.backgroundColor = "#0050c0";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.backgroundColor = "#0060df";
              }}
            >
              {browser.i18n.getMessage("chatgpt_win_send")}
            </button>

            {customTextArray.length > 1 && (
              <div
                className="absolute bottom-[6px] right-3 text-[11px]"
                style={{ color: "#aaa" }}
              >
                {currentIndex + 1}/{customTextArray.length}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
