/*
 *  ThunderAI [https://micz.it/thunderbird-addon-thunderai/]
 *  Copyright (C) 2024 - 2026  Mic (m@micz.it)

 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU General Public License as published by
 *  the Free Software Foundation, either version 3 of the License, or
 *  (at your option) any later version.

 *  This program is distributed in the hope that it will be useful,
 *  but WITHOUT ANY WARRANTY; without even the implied warranty of
 *  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *  GNU General Public License for more details.

 *  You should have received a copy of the GNU General Public License
 *  along with this program.  If not, see <http://www.gnu.org/licenses/>.
 * 
 * 
 *  This file contains a modified version of the code from the project at https://github.com/boxabirds/chatgpt-frontend-nobuild
 *  The original code has been released under the Apache License, Version 2.0.
 */

import { prefs_default } from '../options/mzta-options-default.js';
const messagesAreaTemplate = document.createElement('template');

const messagesAreaStyle = document.createElement('style');
messagesAreaStyle.textContent = `
    :host {
        display: flex;
        flex-direction: column;
        height: 100%;
        overflow-y: auto;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    #messages {
        display: flex;
        flex-direction: column;
        padding: 16px;
        gap: 4px;
        overflow-x: hidden;
        overflow-y: scroll;
        flex: 1;
    }
    .message-row {
        display: flex;
        flex-direction: column;
        max-width: 82%;
        gap: 3px;
    }
    .message-row.user {
        align-self: flex-end;
        align-items: flex-end;
    }
    .message-row.bot, .message-row.error, .message-row.info {
        align-self: flex-start;
        align-items: flex-start;
    }
    .message-label {
        font-size: 0.7rem;
        font-weight: 600;
        letter-spacing: 0.04em;
        text-transform: uppercase;
        color: #888;
        padding: 0 4px;
        margin-bottom: 1px;
    }
    .message {
        padding: 10px 14px;
        border-radius: 16px;
        line-height: 1.55;
        font-size: 13.5px;
        word-break: break-word;
    }
    .message.user {
        background-color: #0060df;
        color: #ffffff;
        border-bottom-right-radius: 4px;
    }
    .message.bot {
        background-color: #f0f0f0;
        color: #1a1a1a;
        border-bottom-left-radius: 4px;
    }
    .message.error {
        background-color: #fde8e8;
        color: #b91c1c;
        border-radius: 12px;
    }
    .message.info {
        background-color: #e8f0fe;
        color: #1a4a8a;
        border-radius: 12px;
        font-size: 0.82em;
    }
    .message p {
        margin: 0 0 6px 0;
        padding: 0;
    }
    .message p:last-child {
        margin-bottom: 0;
    }
    .message ul, .message ol {
        margin: 4px 0;
        padding-left: 20px;
    }
    .message code {
        font-family: "SF Mono", "Fira Code", monospace;
        font-size: 0.88em;
        background: rgba(0,0,0,0.08);
        padding: 1px 5px;
        border-radius: 4px;
    }
    .message pre {
        background: rgba(0,0,0,0.06);
        border-radius: 8px;
        padding: 10px 12px;
        overflow-x: auto;
        margin: 6px 0;
    }
    .message pre code {
        background: none;
        padding: 0;
    }
    .message-spacer {
        height: 8px;
    }
    .token {
        display: inline;
        opacity: 0;
        animation: fadeIn 600ms forwards;
    }
    @keyframes fadeIn {
        to { opacity: 1; }
    }
    .action-buttons {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        padding: 6px 0 12px 0;
        align-self: flex-start;
    }
    .action-buttons button {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        padding: 5px 12px;
        border-radius: 20px;
        border: 1px solid #d0d0d0;
        background: #ffffff;
        color: #1a1a1a;
        font-size: 12.5px;
        font-family: inherit;
        cursor: pointer;
        transition: background 80ms ease, border-color 80ms ease;
    }
    .action-buttons button:hover {
        background: #f0f0f0;
        border-color: #bbb;
    }
    .action-buttons button.action_btn {
        background: #0060df;
        color: #ffffff;
        border-color: #0060df;
    }
    .action-buttons button.action_btn:hover {
        background: #0050c0;
        border-color: #0050c0;
    }
    .action-buttons button.close_btn {
        color: #666;
    }
    .action_btn_info {
        font-size: 0.7em;
        opacity: 0.8;
    }
    .sel_info {
        font-size: 0.7rem;
        color: #888;
        margin-top: 2px;
        display: none;
        padding: 0 4px;
    }

    /* Split button */
    .split-button {
        display: inline-flex;
        position: relative;
    }
    .split-button .action_btn {
        border-top-right-radius: 0;
        border-bottom-right-radius: 0;
        border-right: 1px solid rgba(255,255,255,0.3);
    }
    .split-button .dropdown-toggle {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 30px;
        padding: 0;
        border-left: none;
        border-top-left-radius: 0;
        border-bottom-left-radius: 0;
        border-top-right-radius: 20px;
        border-bottom-right-radius: 20px;
        background: #0060df;
        color: #fff;
        border-color: #0060df;
        cursor: pointer;
    }
    .split-button .dropdown-toggle:hover {
        background: #0050c0;
    }
    .dropdown-toggle svg {
        fill: currentColor;
    }
    .dropdown-menu {
        position: absolute;
        top: calc(100% + 4px);
        right: 0;
        display: none;
        flex-direction: column;
        background: #ffffff;
        border: 1px solid #d0d0d0;
        border-radius: 10px;
        min-width: 160px;
        z-index: 1000;
        box-shadow: 0 4px 12px rgba(0,0,0,0.12);
        overflow: hidden;
    }
    .dropdown-menu button {
        padding: 9px 14px;
        border: none;
        border-radius: 0;
        background: #ffffff;
        text-align: left;
        cursor: pointer;
        font-size: 12.5px;
        color: #1a1a1a;
    }
    .dropdown-menu button:hover {
        background: #f0f0f0;
    }
    .dropdown-menu.show {
        display: flex;
    }

    /* diff viewer */
    .added {
        background-color: #d4fcdc;
        display: inline;
        border-radius: 2px;
    }
    .removed {
        background-color: #fddddd;
        display: inline;
        text-decoration: line-through;
        border-radius: 2px;
    }
    .info_obj {
        color: rgb(0, 71, 36);
    }

    @media (prefers-color-scheme: dark) {
        .message.bot {
            background-color: #2a2a2a;
            color: #e8e8e8;
        }
        .message.user {
            background-color: #0050c0;
        }
        .message.error {
            background-color: #3a1a1a;
            color: #fca5a5;
        }
        .message.info {
            background-color: #1a2a3a;
            color: #93c5fd;
        }
        .message code {
            background: rgba(255,255,255,0.1);
        }
        .message pre {
            background: rgba(255,255,255,0.06);
        }
        .action-buttons button {
            background: #2a2a2a;
            color: #e8e8e8;
            border-color: #444;
        }
        .action-buttons button:hover {
            background: #333;
            border-color: #555;
        }
        .action-buttons button.action_btn {
            background: #0050c0;
            border-color: #0050c0;
        }
        .action-buttons button.action_btn:hover {
            background: #0040a0;
            border-color: #0040a0;
        }
        .dropdown-menu {
            background: #2a2a2a;
            border-color: #444;
        }
        .dropdown-menu button {
            background: #2a2a2a;
            color: #e8e8e8;
        }
        .dropdown-menu button:hover {
            background: #333;
        }
        .split-button .dropdown-toggle {
            background: #0050c0;
            border-color: #0050c0;
        }
        .added {
            background-color: rgb(0, 94, 0);
        }
        .removed {
            background-color: rgb(90, 0, 0);
        }
    }
`;
messagesAreaTemplate.content.appendChild(messagesAreaStyle);

const messagesDiv = document.createElement('div');
messagesDiv.id = 'messages';
messagesAreaTemplate.content.appendChild(messagesDiv);

class MessagesArea extends HTMLElement {

    fullTextHTML = "";
    llmName = "LLM";

    constructor() {
        super();
        this.accumulatingMessageEl = null;

        const shadowRoot = this.attachShadow({ mode: 'open' });
        shadowRoot.appendChild(messagesAreaTemplate.content.cloneNode(true));

        this.messages = shadowRoot.querySelector('#messages');
    }

    createNewAccumulatingMessage() {
        const row = document.createElement('div');
        row.classList.add('message-row', 'bot');

        const label = document.createElement('div');
        label.classList.add('message-label');
        label.textContent = this.llmName;
        row.appendChild(label);

        this.accumulatingMessageEl = document.createElement('div');
        this.accumulatingMessageEl.classList.add('message', 'bot');
        row.appendChild(this.accumulatingMessageEl);

        this.messages.appendChild(row);
    }

    init(worker) {
        this.worker = worker;
    }

    setLLMName(llmName) {
        this.llmName = llmName;
    }

    async handleTokensDone(promptData = null) {
        this.flushAccumulatingMessage();
        await this.addActionButtons(promptData);
        this.addDivider();
    }

    appendUserMessage(messageText, type="user") {
        this.fullTextHTML = "";

        const row = document.createElement('div');
        row.classList.add('message-row', type);

        const label = document.createElement('div');
        label.classList.add('message-label');
        switch (type) {
            case "user":
                label.textContent = browser.i18n.getMessage("apiwebchat_you");
                break;
            case "info":
                label.textContent = browser.i18n.getMessage("apiwebchat_info");
                break;
        }
        row.appendChild(label);

        const messageElement = document.createElement('div');
        messageElement.classList.add('message', type);
        if (type === "info") {
            messageElement.appendChild(htmlStringToFragment(messageText));
        } else {
            messageElement.appendChild(textWithBrToFragment(messageText));
        }
        row.appendChild(messageElement);

        this.messages.appendChild(row);
        this.scrollToBottom();
    }

    appendBotMessage(messageText, type="bot") {
        this.fullTextHTML = messageText;

        const row = document.createElement('div');
        row.classList.add('message-row', type);

        const label = document.createElement('div');
        label.classList.add('message-label');
        label.textContent = this.llmName + (type === 'error' ? ' — ' + browser.i18n.getMessage("apiwebchat_error") : '');
        row.appendChild(label);

        const messageElement = document.createElement('div');
        messageElement.classList.add('message', type);
        messageElement.textContent = messageText;
        row.appendChild(messageElement);

        this.messages.appendChild(row);
        this.scrollToBottom();
    }

    handleNewToken(token) {
        if (!this.accumulatingMessageEl) {
            this.createNewAccumulatingMessage();
        }

        const newTokenElement = document.createElement('span');
        newTokenElement.classList.add('token');
        newTokenElement.textContent = token;
        this.accumulatingMessageEl.appendChild(newTokenElement);

        this.scrollToBottom();

        if (token === '\n') {
            this.flushAccumulatingMessage();
        }
    }

    scrollToBottom() {
        this.messages.scrollTop = this.messages.scrollHeight;
    }

    // Helper to create dropdown options
    createOption(label, callback) {
        const btn = document.createElement('button');
        btn.textContent = label;
        btn.onclick = callback;
        return btn;
    }

    // click callcback for the "use this answer" button
    handleUseThisAnswerButtonClick(promptData, replyType, fullTextHTMLAtAssignment){
        return async () => {
            if(promptData.mailMessageId == -1) {    // we are using the reply from the compose window!
                promptData.action = "2"; // replace text
            }
            let finalText = removeAloneBRs(fullTextHTMLAtAssignment);
            const selectedHTML = this.getCurrentSelectionHTML();
            if(selectedHTML != "") {
                finalText = removeAloneBRs(selectedHTML);
            }

            switch(promptData.action) {
                case "1":     // do reply
                    // console.log("[ThunderAI] (do reply) fullTextHTMLAtAssignment: " + fullTextHTMLAtAssignment);
                    await browser.runtime.sendMessage({command: "chatgpt_replyMessage", text: finalText, tabId: promptData.tabId, mailMessageId: promptData.mailMessageId, replyType: replyType});
                    browser.runtime.sendMessage({command: "chatgpt_close", window_id: (await browser.windows.getCurrent()).id});
                    break;
                case "2":     // replace text
                    //  console.log("[ThunderAI] (replace text) fullTextHTMLAtAssignment: " + fullTextHTMLAtAssignment);
                    await browser.runtime.sendMessage({command: "chatgpt_replaceSelectedText", text: finalText, tabId: promptData.tabId, mailMessageId: promptData.mailMessageId});
                    browser.runtime.sendMessage({command: "chatgpt_close", window_id: (await browser.windows.getCurrent()).id});
                    break;
            }
        }
    }

    async addActionButtons(promptData = null) {
        if(promptData == null) { return; }
        const actionButtons = document.createElement('div');
        actionButtons.classList.add('action-buttons');
        // Create the main container for the "use this answer" button when replying
        const splitButton = document.createElement('div');
        splitButton.className = 'split-button';
        // selection info
        const selectionInfo = document.createElement('p');
        selectionInfo.textContent = browser.i18n.getMessage("apiwebchat_selection_info");
        selectionInfo.classList.add('sel_info');
        // main button
        const actionButton = document.createElement('button');
        actionButton.className = 'action_btn';
        const actionButton_line1 = document.createElement('span');
        actionButton_line1.textContent = browser.i18n.getMessage("apiwebchat_use_this_answer");
        actionButton.appendChild(actionButton_line1);
        splitButton.appendChild(actionButton);
        const fullTextHTMLAtAssignment = this.fullTextHTML.trim().replace(/^"|"$/g, '').replace(/^<p>&quot;/, '<p>').replace(/&quot;<\/p>$/, '</p>'); // strip quotation marks
        //console.log(">>>>>>>>>>>> fullTextHTMLAtAssignment: " + fullTextHTMLAtAssignment);
        let reply_type_pref = await browser.storage.sync.get({ reply_type: prefs_default.reply_type });
        if((promptData.action == "1") && (promptData.mailMessageId != -1)) {
            const actionButton_line2 = document.createElement('span');
            actionButton_line2.classList.add('action_btn_info');
            actionButton_line2.textContent = reply_type_pref.reply_type == 'reply_all' ? browser.i18n.getMessage("prefs_OptionText_reply_all") : browser.i18n.getMessage("prefs_OptionText_reply_sender");
            actionButton.appendChild(document.createElement('br'));
            actionButton.appendChild(actionButton_line2);
            // Dropdown toggle button
            const toggleBtn = document.createElement('button');
            toggleBtn.className = 'dropdown-toggle';
            toggleBtn.setAttribute('aria-label', 'Show options');
            // SVG icon
            const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            svg.setAttribute('viewBox', '0 0 20 20');
            svg.setAttribute('width', '16');
            svg.setAttribute('height', '16');
            svg.setAttribute('fill', 'currentColor');
            svg.setAttribute('stroke-width', '2');
            const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            path.setAttribute('d', 'M19 9l-7 7-7-7');
            svg.appendChild(path);
            toggleBtn.appendChild(svg);
            splitButton.appendChild(toggleBtn);
            // Dropdown menu
            const dropdown = document.createElement('div');
            dropdown.className = 'dropdown-menu';
            dropdown.id = 'dropdown';
            // Add options
            dropdown.appendChild(this.createOption(
                reply_type_pref.reply_type == 'reply_all' ? browser.i18n.getMessage("prefs_OptionText_reply_sender") : browser.i18n.getMessage("prefs_OptionText_reply_all"),
                this.handleUseThisAnswerButtonClick(promptData, reply_type_pref.reply_type == 'reply_all' ? 'reply_sender' : 'reply_all', fullTextHTMLAtAssignment))
            );
            splitButton.appendChild(dropdown);
            let dropdownJustOpened = false;
            // Toggle function
            toggleBtn.onclick = () => {
                dropdownJustOpened = true;
                dropdown.classList.toggle('show');
            };
            // Close on outside click
            window.addEventListener('click', (e) => {
            // Delay the execution to allow other handlers (like toggle) to run first
                if (dropdownJustOpened) {
                    dropdownJustOpened = false;
                    return; // Skip this click because it's the one that opened the menu
                }
                setTimeout(() => {
                    if (!splitButton.contains(e.target)) {
                        dropdown.classList.remove('show');
                    }
                }, 0);
            });
        }else{
            actionButton.style.paddingRight = "10px";
            actionButton.style.borderTopRightRadius = "5px";
            actionButton.style.borderBottomRightRadius = "5px";
            actionButton.style.marginRight = "10px";
        }
        actionButton.addEventListener('click', this.handleUseThisAnswerButtonClick(promptData,reply_type_pref.reply_type, fullTextHTMLAtAssignment));
        const closeButton = document.createElement('button');
        closeButton.textContent = browser.i18n.getMessage("chatgpt_win_close");
        closeButton.classList.add('close_btn');
        closeButton.addEventListener('click', async () => {
            browser.runtime.sendMessage({command: "chatgpt_close", window_id: (await browser.windows.getCurrent()).id});    // close window
        });
        if(promptData.action != 0) { 
            actionButtons.appendChild(splitButton);
            selectionInfo.style.display = "block"; // show selection info
        }

        // diff viewer button
        if(promptData.prompt_info?.use_diff_viewer == "1") {
            const diffvButton = document.createElement('button');
            diffvButton.textContent = browser.i18n.getMessage("btn_show_differences");
            diffvButton.classList.add('diffv_btn');
            diffvButton.addEventListener('click', async () => {
                let strippedText = fullTextHTMLAtAssignment.replace(/<\/?[^>]+(>|$)/g, "");
                let originalText = promptData.prompt_info?.selection_text;
                if((originalText == null) || (originalText == "")) {
                    originalText = promptData.prompt_info?.body_text;
                }
                this.appendDiffViewer(originalText, strippedText);
                diffvButton.disabled = true;
            });
            actionButtons.appendChild(diffvButton);
        }

        actionButtons.appendChild(closeButton);
        this.messages.appendChild(actionButtons);
        this.messages.appendChild(selectionInfo);
        this.scrollToBottom();
    }

    addDivider() {
        const spacer = document.createElement('div');
        spacer.classList.add('message-spacer');
        this.messages.appendChild(spacer);
        this.scrollToBottom();
    }

    appendDiffViewer(originalText, newText) {
        const wordDiff = Diff.diffWords(originalText, newText);

        const messageElement = document.createElement('div');
        messageElement.classList.add('message', 'bot');

        // Iterate over each part of the diff to create the HTML output
        wordDiff.forEach(part => {
            // Split part.value by <br> (handling <br>, <br/>, <br />)
            const brRegex = /(<br\s*\/?>)/gi;
            const segments = part.value.split(brRegex);

            segments.forEach(segment => {
            if (segment.match(brRegex)) {
                // It's a <br>, add a real <br> element
                messageElement.appendChild(document.createElement("br"));
            } else if (segment.length > 0) {
                const diffElement = document.createElement("span");
                if (part.added) {
                diffElement.className = "added";
                diffElement.textContent = segment;
                } else if (part.removed) {
                diffElement.className = "removed";
                diffElement.textContent = segment;
                } else {
                diffElement.textContent = segment;
                }
                messageElement.appendChild(diffElement);
            }
            });
        });

        const row = document.createElement('div');
        row.classList.add('message-row', 'bot');

        const label = document.createElement('div');
        label.classList.add('message-label');
        label.textContent = browser.i18n.getMessage("chatgpt_win_diff_title");
        row.appendChild(label);
        row.appendChild(messageElement);

        this.messages.appendChild(row);
        this.addDivider();
        this.scrollToBottom();
    }

    flushAccumulatingMessage() {
        if (this.accumulatingMessageEl) {
            // Collect all tokens in a full text
            let fullText = '';
            this.accumulatingMessageEl.querySelectorAll('.token').forEach(tokenEl => {
                fullText += tokenEl.textContent;
            });
    
            // Convert Markdown to DOM nodes using the markdown-it library
            const md = window.markdownit();
            const html = md.render(fullText);

            this.fullTextHTML += html;

            // console.log(">>>>>>>>>>>>>>>> flushAccumulatingMessage this.fullTextHTML: " + this.fullTextHTML);
    
            // Create a new DOM parser
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            convertTextNodeNewlinesToBr(doc.body);
    
            // Remove existing tokens
            while (this.accumulatingMessageEl.firstChild) {
                this.accumulatingMessageEl.removeChild(this.accumulatingMessageEl.firstChild);
            }
    
            // Append new nodes
            Array.from(doc.body.childNodes).forEach(node => {
                this.accumulatingMessageEl.appendChild(node);
            });
  
            this.accumulatingMessageEl = null;
        }
    }

    getCurrentSelectionHTML() {
        const selection = window.getSelection();
        // console.log(">>>>>>>>>>>>>>>> getCurrentSelectionHTML: " + JSON.stringify(selection.toString()));
        if (selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            const container = document.createElement('div');
            container.appendChild(range.cloneContents());
            return container.innerHTML;
        }
        return '';
    }

}

customElements.define('messages-area', MessagesArea);


function textWithBrToFragment(text) {
    const fragment = document.createDocumentFragment();
    const segments = text.split(/<br\s*\/?>/gi);
    segments.forEach((segment, idx) => {
        if (segment.length > 0) {
            fragment.appendChild(document.createTextNode(segment));
        }
        if (idx < segments.length - 1) {
            fragment.appendChild(document.createElement('br'));
        }
    });
    return fragment;
}

function htmlStringToFragment(htmlString) {
//   console.log(">>>>>>>>>>>>>>>> htmlStringToFragment htmlString: " + htmlString);
  const normalizedHtml = htmlString.replace(/\n/g, '<br>');
//   console.log(">>>>>>>>>>>>>>>> htmlStringToFragment normalizedHtml: " + normalizedHtml);
  const parser = new DOMParser();
  const doc = parser.parseFromString(normalizedHtml, 'text/html');
  const fragment = document.createDocumentFragment();
  Array.from(doc.body.childNodes).forEach(node => fragment.appendChild(node));
  return fragment;
}

function convertTextNodeNewlinesToBr(element) {
    element.childNodes.forEach(node => {
        if (node.nodeType === Node.TEXT_NODE) {
            if (node.textContent.includes('\n') && node.textContent.trim() !== '') {
                const fragment = document.createDocumentFragment();
                node.textContent.split('\n').forEach((part, idx, arr) => {
                    fragment.appendChild(document.createTextNode(part));
                    if (idx < arr.length - 1) {
                        fragment.appendChild(document.createElement('br'));
                    }
                });
                node.parentNode.replaceChild(fragment, node);
            }
        } else if (node.nodeType === Node.ELEMENT_NODE) {
            convertTextNodeNewlinesToBr(node);
        }
    });
}

function removeAloneBRs(htmlString) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlString, 'text/html');

  const brElements = Array.from(doc.querySelectorAll('br'));

  brElements.forEach(br => {
    let current = br;
    let isInsideP = false;

    while (current.parentElement) {
      if (current.parentElement.tagName.toLowerCase() === 'p') {
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
