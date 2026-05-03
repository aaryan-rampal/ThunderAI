# ![ThunderAI icon](images/icon-32px.png "ThunderAI") ThunderAI — Personal Fork

> **This is a personal fork of [ThunderAI by micz](https://github.com/micz/ThunderAI).** It contains experimental changes that diverge from the upstream extension. If people find it useful, it may grow into something more.

ThunderAI integrates multiple AI providers (ChatGPT Web, OpenAI API, Google Gemini, Claude/Anthropic, Ollama, and OpenAI-compatible APIs) directly into Thunderbird.

<br>

## What's different in this fork

### Modernized chat interface
- Rebuilt `api_webchat` with **React + TypeScript + Tailwind CSS** (Vite build)
- Chat bubbles and pill-style action buttons replacing the original flat layout
- Proper markdown rendering in AI responses

### Copilot mode
- AI replies open in a **persistent copilot tab** rather than ephemeral popups
- Two-column layout with a sidebar for session navigation
- Sessions stored in IndexedDB; conversation history resets cleanly on new sessions

### RAG (Retrieval-Augmented Generation)
- Background embedding pipeline indexes your emails into IndexedDB
- Email-triggered RAG: mentioning an email in chat kicks off automatic indexing
- Session-scoped vector retrieval feeds relevant email context into prompts
- Configurable embedding model and title model via the options page

### Toolchain
- Node build pipeline for bundling, verification, and packaging
- All five per-provider web workers consolidated into one

<br>

## AI Provider Support

> [!NOTE]
> **Available Integrations**
> - **ChatGPT Web** — no API key needed, free account works
> - **OpenAI API** — connect with your API key
> - **Google Gemini** — supports System Instructions and thinkingBudget
> - **Claude API** — requires the "_Access your data for sites in the https://anthropic.com domain_" permission
> - **Ollama** — set `OLLAMA_ORIGINS = moz-extension://*` on the server; [CORS info](https://micz.it/thunderbird-addon-thunderai/ollama-cors-information/)
> - **OpenAI Compatible API** — LM Studio, Mistral AI, DeepSeek, Grok, OpenRouter, Perplexity, and more

<br>

## Original features (still present)

- Analyse, write, correct, tag, summarize, and reply to emails
- Create calendar events and tasks from email content
- Automatic incoming email tagging and spam filtering (API integrations)
- Custom prompts with data placeholders — [docs](https://micz.it/thunderbird-addon-thunderai/custom-prompts/)

<br>

## Upstream

The original extension is maintained by [micz](https://github.com/micz/ThunderAI) and published on [addons.thunderbird.net](https://addons.thunderbird.net). For production use, prefer the upstream release.

Upstream docs:
- [Setup Guides](https://micz.it/thunderbird-addon-thunderai/guides/)
- [Custom Prompt Tutorial](https://micz.it/thunderbird-addon-thunderai/tutorial/)
- [ThunderAI Prompt Architect GPT](https://chatgpt.com/g/g-69b6b11c89b88191a6798be6e97025f1-thunder-ai-prompt-architect)

<br>

## Attributions

### Translations (upstream)
- Brazilian Portuguese (pt-br): Bruno Pereira de Souza
- Chinese Simplified (zh_Hans): [jeklau](https://github.com/jeklau), [Min9X1n](https://github.com/Min9X1n)
- Chinese Traditional (zh_Hant): [evez](https://github.com/evez)
- Croatian (hr): Petar Jedvaj
- Czech (cs): [Fjuro](https://hosted.weblate.org/user/Fjuro/), [Jaroslav Staněk](https://hosted.weblate.org/user/jaroush/)
- French (fr): Generated automatically, [Noam](https://github.com/noam-sc)
- German (de): Generated automatically
- Greek (el): [ChristosK.](https://github.com/christoskaterini)
- Italian (it): [Mic](https://github.com/micz)
- Japanese (ja): [Taichi Ito](https://github.com/watya1)
- Polish (pl): [neexpl](https://github.com/neexpl), [makkacprzak](https://github.com/makkacprzak)
- Russian (ru): [Maksim](https://hosted.weblate.org/user/law820314/)
- Spanish (es): [Gerardo Sobarzo](https://hosted.weblate.org/user/gerardo.sobarzo/), [Andrés Rendón Hernández](https://hosted.weblate.org/user/arendon/), [Erick Limon](https://hosted.weblate.org/user/ErickLimonG/)
- Swedish (sv): [Andreas Pettersson](https://hosted.weblate.org/user/Andy_tb/), [Luna Jernberg](https://hosted.weblate.org/user/bittin1ddc447d824349b2/)

### Graphics
- ChatGPT-4 for the addon icon
- [loading.io](https://loading.io) for loading SVGs
- [Fluent Design System](https://www.iconfinder.com/fluent-designsystem) for sorting icons
- [JessiGue](https://www.flaticon.com/authors/jessigue) for the show/hide icon
- [Iconka.com](https://www.iconarchive.com/artist/iconka.html) for the autotag icon
- [Icojam](https://www.iconarchive.com/artist/icojam.html) for the spam filter icon
- [Roundicons](https://www.flaticon.com/authors/roundicons) for the summarize icon

### Miscellaneous
- [chatgpt.js](https://github.com/KudoAI/chatgpt.js) for ChatGPT web interaction
- [Julian Harris](https://github.com/boxabirds) / [chatgpt-frontend-nobuild](https://github.com/boxabirds/chatgpt-frontend-nobuild) as the original API web interface starting point
- [Hosted Weblate](https://hosted.weblate.org/widgets/thunderai/) for localization management
