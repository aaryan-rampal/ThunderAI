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

const messageInputTemplate = document.createElement('template');

const messagesInputStyle  = document.createElement('style');
messagesInputStyle.textContent = `
    :host {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 10px 16px 14px;
        gap: 8px;
        border-top: 1px solid #e5e5e5;
        background: #ffffff;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    #messageInputField {
        flex-grow: 1;
        padding: 9px 14px;
        font-size: 13.5px;
        font-family: inherit;
        border: 1px solid #d0d0d0;
        border-radius: 20px;
        outline: none;
        background: #f7f7f7;
        color: #1a1a1a;
        transition: border-color 100ms ease, background 100ms ease;
    }
    #messageInputField:focus {
        border-color: #0060df;
        background: #ffffff;
    }
    #sendButton, #stopButton {
        width: 36px;
        height: 36px;
        flex-shrink: 0;
        cursor: pointer;
        border-radius: 50%;
        border: none;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: background 80ms ease;
    }
    #sendButton {
        background: #0060df;
        color: #ffffff;
    }
    #sendButton:hover {
        background: #0050c0;
    }
    #sendButton:disabled {
        background: #ccc;
        cursor: default;
    }
    #stopButton {
        background: #f0f0f0;
        color: #1a1a1a;
    }
    #stopButton:hover {
        background: #e0e0e0;
    }
    #statusLogger {
        font-size: 0.78rem;
        position: absolute;
        bottom: 4em;
        right: 1em;
        border: 1px solid #e0e0e0;
        border-radius: 8px;
        padding: 5px 10px;
        background: #f7f7f7;
        color: #555;
        display: flex;
        align-items: center;
        gap: 5px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.08);
    }
    #statusLoggerImg {
        display: none;
        vertical-align: middle;
        width: 14px;
        height: 14px;
    }
    #mzta-custom_text {
        padding: 16px;
        width: 50%;
        min-width: 300px;
        max-width: 80%;
        height: auto;
        max-height: 80%;
        border-radius: 12px;
        overflow-y: auto;
        overflow-x: hidden;
        position: fixed;
        top: 50%;
        left: 50%;
        display: none;
        transform: translate(-50%, -50%);
        text-align: center;
        background: #2a2a2a;
        color: #e8e8e8;
        border: 1px solid #444;
        box-sizing: border-box;
        box-shadow: 0 8px 32px rgba(0,0,0,0.4);
    }
    #mzta-custom_loading {
        height: 40px;
        display: none;
    }
    #mzta-custom_textarea {
        color: #1a1a1a;
        padding: 8px;
        font-size: 14px;
        font-family: inherit;
        width: 100%;
        box-sizing: border-box;
        resize: vertical;
        border-radius: 6px;
        border: 1px solid #ccc;
    }
    #mzta-custom_info {
        text-align: center;
        width: 100%;
        padding-bottom: 10px;
        font-size: 14px;
    }
    #mzta-custom_info span {
        font-size: 0.82em;
        opacity: 0.7;
    }
    #mzta-custom_step {
        position: absolute;
        bottom: 6px;
        right: 12px;
        font-size: 11px;
        color: #aaa;
    }
    #mzta-custom_btn {
        margin-top: 10px;
        padding: 7px 18px;
        border-radius: 20px;
        border: none;
        background: #0060df;
        color: #fff;
        font-size: 13.5px;
        font-family: inherit;
        cursor: pointer;
    }
    #mzta-custom_btn:hover {
        background: #0050c0;
    }
    @media (prefers-color-scheme: dark) {
        :host {
            background: #1e1e1e;
            border-top-color: #3a3a3a;
        }
        #messageInputField {
            background: #2a2a2a;
            color: #e8e8e8;
            border-color: #444;
        }
        #messageInputField:focus {
            border-color: #4a9eff;
            background: #2a2a2a;
        }
        #stopButton {
            background: #2a2a2a;
            color: #e8e8e8;
        }
        #stopButton:hover {
            background: #333;
        }
        #statusLogger {
            background: #2a2a2a;
            color: #ccc;
            border-color: #444;
        }
    }
`;
messageInputTemplate.content.appendChild(messagesInputStyle);

const inputField = document.createElement('input');
inputField.type = 'text';
inputField.id = 'messageInputField';
inputField.placeholder = '';
inputField.autocomplete = 'off';
messageInputTemplate.content.appendChild(inputField);

const sendButton = document.createElement('button');
sendButton.id = 'sendButton';

const sendIcon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
sendIcon.setAttribute('width', '24');
sendIcon.setAttribute('height', '24');
sendIcon.setAttribute('viewBox', '0 0 24 24');
sendIcon.setAttribute('fill', 'none');
sendIcon.classList.add('text-white', 'dark:text-black');

const sendPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
sendPath.setAttribute('d', 'M7 11L12 6L17 11M12 18V7');
sendPath.setAttribute('stroke', 'currentColor');
sendPath.setAttribute('stroke-width', '2');
sendPath.setAttribute('stroke-linecap', 'round');
sendPath.setAttribute('stroke-linejoin', 'round');

sendIcon.appendChild(sendPath);
sendButton.appendChild(sendIcon);
messageInputTemplate.content.appendChild(sendButton);

const stopButton = document.createElement('button');
stopButton.id = 'stopButton';
stopButton.style.display = 'none';

const stopIcon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
stopIcon.setAttribute('width', '24');
stopIcon.setAttribute('height', '24');
stopIcon.setAttribute('viewBox', '0 0 24 24');
stopIcon.setAttribute('fill', 'none');
stopIcon.classList.add('text-white', 'dark:text-black');

const stopRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
stopRect.setAttribute('x', '6');
stopRect.setAttribute('y', '6');
stopRect.setAttribute('width', '12');
stopRect.setAttribute('height', '12');
stopRect.setAttribute('fill', 'currentColor');

stopIcon.appendChild(stopRect);
stopButton.appendChild(stopIcon);
messageInputTemplate.content.appendChild(stopButton);

const statusLogger = document.createElement('div');
statusLogger.id = 'statusLogger';
statusLogger.style.display = 'none';
const statusLoggerImg = document.createElement('img');
statusLoggerImg.id = 'statusLoggerImg';
statusLoggerImg.src = browser.runtime.getURL('/images/mzta-loading.svg');
statusLogger.appendChild(statusLoggerImg);
const statusLoggerText = document.createElement('span');
statusLoggerText.id = 'statusLoggerText';
statusLogger.appendChild(statusLoggerText);
messageInputTemplate.content.appendChild(statusLogger);

//div per custom text
const customDiv = document.createElement('div');
customDiv.id = 'mzta-custom_text';
const customInfo = document.createElement('div');
customInfo.id = 'mzta-custom_info';
customInfo.textContent = browser.i18n.getMessage("chatgpt_win_custom_text");
customDiv.appendChild(customInfo);
const customTextArea = document.createElement('textarea');
customTextArea.id = 'mzta-custom_textarea';
customTextArea.rows = 5;
customDiv.appendChild(customTextArea);
const customLoading = document.createElement('img');
customLoading.src = browser.runtime.getURL("/images/loading.gif");
customLoading.id = "mzta-custom_loading";
customDiv.appendChild(customLoading);
const customBtn = document.createElement('button');
customBtn.id = 'mzta-custom_btn';
customBtn.textContent = browser.i18n.getMessage("chatgpt_win_send");
customBtn.classList.add('mzta-btn');
customDiv.appendChild(customBtn);
const customStep = document.createElement('div');
customStep.id = 'mzta-custom_step';
customDiv.appendChild(customStep);
messageInputTemplate.content.appendChild(customDiv);

class MessageInput extends HTMLElement {

    model = '';
    _customTextArray = [];
    _currentCustomTextIndex = 0;

    constructor() {
        super();
        const shadowRoot = this.attachShadow({ mode: 'open' });
        shadowRoot.appendChild(messageInputTemplate.content.cloneNode(true));

        this._messageInputField = shadowRoot.querySelector('#messageInputField');
        this._sendButton = shadowRoot.querySelector('#sendButton');
        this._stopButton = shadowRoot.querySelector('#stopButton');
        this._statusLogger = shadowRoot.querySelector('#statusLogger');
        this._statusLoggerImg = shadowRoot.querySelector('#statusLoggerImg');
        this._statusLoggerText = shadowRoot.querySelector('#statusLoggerText');

        this._messageInputField.addEventListener('keydown', this._handleKeyDown.bind(this));
        this._sendButton.addEventListener('click', this._handleClick.bind(this));
        this._stopButton.addEventListener('click', this._handleStopClick.bind(this));

        this._customText = shadowRoot.querySelector('#mzta-custom_text');
        this._customTextArea = shadowRoot.querySelector('#mzta-custom_textarea');
        this._customLoading = shadowRoot.querySelector('#mzta-custom_loading');
        this._customBtn = shadowRoot.querySelector('#mzta-custom_btn');
        this._customStep = shadowRoot.querySelector('#mzta-custom_step');
        this._customBtn.addEventListener("click", () => { this._customTextBtnClick({customBtn:this._customBtn,customLoading:this._customLoading,customDiv:this._customText}) });
        this._customTextArea.addEventListener("keydown", (event) => {
            if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                this._customTextBtnClick({customBtn:this._customBtn,customLoading:this._customLoading,customDiv:this._customText});
            }
        });
    }

    connectedCallback() {
        // Set focus to the input field when the element is added to the DOM
        this._messageInputField.focus();
    }

    async init(worker) {
        this.worker = worker;
    }

    setMessagesArea(messagesAreaComponent) {
        this.messagesAreaComponent = messagesAreaComponent;
    }

    setModel(model){
        this.model = model;
        this._sendButton.title = browser.i18n.getMessage("chagpt_api_send_button") + ": " + this.model;
        this._stopButton.title = browser.i18n.getMessage("chagpt_api_send_button") + ": " + this.model;
    }

    handleMessageSent() {
        // console.log("[ThunderAI] handleMessageSent");
        this._messageInputField.value = '';
    }

    enableInput() {
        // console.log("[ThunderAI] enableInput");
        this._messageInputField.value = '';
        this._messageInputField.removeAttribute('disabled');
        this._sendButton.removeAttribute('disabled');
        this._sendButton.style.display = 'block';
        this._stopButton.setAttribute('disabled', 'disabled');
        this._stopButton.style.display = 'none';
        this._stopButton.title = browser.i18n.getMessage("chagpt_api_send_button") + ": " + this.model;
        this.hideStatusMessage();
        this.setStatusMessage('');
    }

    setStatusMessage(message) {
        this._statusLoggerText.textContent = message;
    }

    showStatusMessage() {
        this._statusLogger.style.display = 'flex';
    }

    hideStatusMessage() {
        this._statusLogger.style.display = 'none';
        this._statusLoggerImg.style.display = 'none';
    }

    _handleKeyDown(event) {
        if (event.key === 'Enter') {
            this._handleNewChatMessage();
        }
    }

    _handleClick() {
        this._handleNewChatMessage();
    }

    _handleStopClick() {
        this.worker.postMessage({ type: 'stop' });
        this._stopButton.setAttribute('disabled', 'disabled');
        this._stopButton.title = browser.i18n.getMessage("apiwebchat_stopping") +  '...';
    }

    _handleNewChatMessage() {
        //do nothing if input is empty
        if ((!this._messageInputField.value)||(this._messageInputField.value.trim().length === 0)) {
            return;
        }
        // prevent user from interacting while we're waiting
        this._sendButton.setAttribute('disabled', 'disabled');
        this._sendButton.style.display = 'none';
        this._stopButton.removeAttribute('disabled');
        this._stopButton.style.display = 'block';
        this._messageInputField.setAttribute('disabled', 'disabled');
        let messageContent = this._messageInputField.value;
        this._messageInputField.value = '';
        if (this.messagesAreaComponent) {
            this.messagesAreaComponent.appendUserMessage(messageContent);
        }
        this.setStatusMessage(browser.i18n.getMessage('WaitingServerResponse') + '...');
        this._statusLoggerImg.style.display = 'inline';
        this.showStatusMessage();
        this.worker.postMessage({ type: 'chatMessage', message: messageContent });
    }

    _setMessageInputValue(msg) {
        this._messageInputField.value = msg;
    }

    _showCustomTextField(custom_text_array){
        this._customTextArray = custom_text_array || [];
        if (this._customTextArray.length === 0) {
             this._customTextArray.push({ placeholder: "{%additional_text%}", info: "" });
        }
        this._currentCustomTextIndex = 0;
        this._customText.style.display = 'block';
        this._renderCustomTextStep();
    }

    _renderCustomTextStep() {
        const currentItem = this._customTextArray[this._currentCustomTextIndex];
        const infoDiv = this.shadowRoot.querySelector('#mzta-custom_info');
        
        this._customTextArea.value = "";
        infoDiv.textContent = browser.i18n.getMessage("chatgpt_win_custom_text");
        
        if (currentItem.info && currentItem.info.trim() !== "") {
            infoDiv.appendChild(document.createElement("br"));
            const infoSpan = document.createElement("span");
            infoSpan.textContent = "[" + browser.i18n.getMessage("customPrompts_form_label_ID") + ": " + currentItem.info + "]";
            infoDiv.appendChild(infoSpan);
        }

        if(this._customTextArray.length > 1) {
            this._customStep.textContent = (this._currentCustomTextIndex + 1) + "/" + this._customTextArray.length;
            this._customStep.style.display = 'block';
        } else {
            this._customStep.style.display = 'none';
        }
        
        this._customTextArea.focus();
    }

    async _customTextBtnClick(args) {
        const customText = this._customTextArea.value;
        
        if (this._customTextArray[this._currentCustomTextIndex]) {
            this._customTextArray[this._currentCustomTextIndex].custom_text = customText;
        }

        this._currentCustomTextIndex++;

        if (this._currentCustomTextIndex < this._customTextArray.length) {
            this._renderCustomTextStep();
        } else {
            args.customBtn.disabled = true;
            args.customBtn.classList.add('disabled');
            args.customLoading.style.display = 'inline-block';
            
            let tab = await browser.tabs.query({ active: true, currentWindow: true });
            browser.runtime.sendMessage({ command: "api_send_custom_text", custom_text: this._customTextArray, tabId: tab[0].id });
            args.customDiv.style.display = 'none';
            
            args.customBtn.disabled = false;
            args.customBtn.classList.remove('disabled');
            args.customLoading.style.display = 'none';
        }
    }
}

customElements.define('message-input', MessageInput);