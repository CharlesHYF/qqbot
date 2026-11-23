<h1 align="center">qqbot</h1>

<p align="center">A QQ group Q&A bot that answers only from a Markdown wiki: one Cloudflare Worker, Karpathy-style LLM Wiki pages and a free GLM model, with text, image and mp4 replies and no server to run</p>

<div align="center">

![Version](https://img.shields.io/badge/version-0.1.0-blue?style=flat-square) ![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?style=flat-square&logo=typescript&logoColor=white) ![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-F38020?style=flat-square&logo=cloudflare&logoColor=white) [![verify](https://github.com/CharlesHYF/qqbot/actions/workflows/verify.yml/badge.svg)](https://github.com/CharlesHYF/qqbot/actions/workflows/verify.yml) ![License](https://img.shields.io/badge/license-proprietary-lightgrey?style=flat-square)

</div>

<p align="center">
  English | <a href="README.zh-CN.md">简体中文</a>
</p>

<p align="center">
  <a href="#quick-start">Quick Start</a> |
  <a href="#writing-the-wiki">Writing the Wiki</a> |
  <a href="#configuration">Configuration</a> |
  <a href="docs/modules/backend/qa-bot.md">Module Doc</a>
</p>

## Table of Contents

- [Features](#features)
- [How It Works](#how-it-works)
- [Quick Start](#quick-start)
  - [Prerequisites](#prerequisites)
  - [Run Locally](#run-locally)
  - [Deploy](#deploy)
- [Writing the Wiki](#writing-the-wiki)
- [Configuration](#configuration)
- [Development](#development)
- [Known Limitations](#known-limitations)
- [License](#license)

## Features

- **Answers only from the wiki**: the model first reads `wiki/pages/index.md` to pick at most 3 relevant pages, then answers from those pages only. It may summarize and rephrase but must not add facts outside the wiki. Off-topic questions get a fixed refusal without a second model call.
- **Karpathy LLM Wiki layout**: read-only sources in `wiki/raw/`, maintained pages in `wiki/pages/`, a page catalog in `index.md` and an append-only `log.md`. Because pages are chosen from the index, the prompt size does not grow with the wiki.
- **Text, image and mp4 replies**: images (png/jpg) and videos (mp4) in `wiki/media/` are published as Worker static assets. A reply sends the text first, then up to 4 media files, which fits the 5 passive replies QQ allows per message. Only files referenced by the chosen pages can be sent.
- **Zero cost, no server**: runs on the Cloudflare Workers free plan and the free GLM-4-Flash model. Paid web search is intentionally not used.
- **Verified callbacks**: incoming events are checked with Ed25519 using a key derived from the AppSecret, matching the official botgo SDK and the documented test vectors. Repeated deliveries of the same message are skipped through Workers KV.
- **Graceful failures**: a model error replies "please try again later"; a failed media upload is logged and skipped without affecting the text answer.

## How It Works

```
QQ group              QQ Open Platform         Cloudflare Worker                     GLM
--------------        -----------------        ---------------------------------     --------------
@bot question   ->    POST /webhook      ->    verify Ed25519 signature
                                         <-    {"op": 12} ACK
                                               dedupe message id (KV)
                                               pick pages from index.md        ->    page names / NONE
                                               answer from chosen pages        ->    answer / NONE
                      send text (seq 1)  <-
                      upload media URL   <-    /<file> from wiki/media
                      send media (seq 2+)<-
```

## Quick Start

### Prerequisites

- Node.js 24 (see `.nvmrc`) and pnpm
- A Cloudflare account
- A QQ bot created on the [QQ Open Platform](https://q.qq.com), with its AppID and AppSecret. A personal developer bot can only join groups where you are the owner or an admin.
- A [Zhipu AI](https://open.bigmodel.cn) API key

### Run Locally

```bash
pnpm install
make setup                       # install the pre-push hook
cp .dev.vars.example .dev.vars   # fill in QQ_APP_ID / QQ_APP_SECRET / LLM_API_KEY
make dev                         # callback URL: http://localhost:8787/webhook
```

### Deploy

```bash
pnpm exec wrangler login
pnpm exec wrangler kv namespace create DEDUP_KV   # put the returned id into wrangler.toml
pnpm exec wrangler secret put QQ_APP_SECRET
pnpm exec wrangler secret put LLM_API_KEY
make deploy
```

Then set `QQ_APP_ID` in `wrangler.toml`, set the callback URL on the QQ Open Platform to `https://<your-worker-domain>/webhook`, subscribe to group @ message events, add the bot to your group and @ it.

## Writing the Wiki

```
wiki/
  SCHEMA.md            layout and maintenance rules
  raw/                 source material, never read by the bot
  pages/
    index.md           one line per page: - [Title](file.md) -- summary
    log.md             append-only maintenance log, not used for answers
    *.md               wiki pages
  media/               png / jpg / mp4
```

- Reference media from a page with a relative path: `![steps](../media/steps.png)` or `[demo video](../media/demo.mp4)`.
- When you add or remove a page, update `index.md`; the bot can only find pages listed there.
- Run `make deploy` after editing the wiki. The build step `scripts/build-wiki.mjs` bundles the pages into the Worker.

The repository ships a small demo wiki about pour-over coffee with one image and one mp4.

## Configuration

| Name | Kind | Description |
| --- | --- | --- |
| `QQ_APP_ID` | var | Bot AppID |
| `QQ_APP_SECRET` | secret | Bot AppSecret, also used to derive the signing key |
| `LLM_BASE_URL` | var | OpenAI-compatible base URL, defaults to `https://open.bigmodel.cn/api/paas/v4` |
| `LLM_MODEL` | var | Model name, defaults to `glm-4-flash-250414` |
| `LLM_API_KEY` | secret | Model API key |
| `DEDUP_KV` | KV binding | Message deduplication, 1 hour TTL |

## Development

```bash
make help          # list all commands
make verify        # incremental spec check + typecheck + lint + tests
make verify-all    # full spec check + tests (before pushing to main)
make dev           # run the Worker locally
make deploy        # deploy to Cloudflare
```

```
src/index.ts                  Worker entry, routing and message deduplication
src/qq/signature.ts           Ed25519 key derivation, signing and verification
src/qq/webhook.ts             callback verification and event dispatch
src/qq/qq-api.ts              access token cache, group messages and media upload
src/llm/llm-client.ts         OpenAI-compatible chat client
src/wiki/wiki-store.ts        wiki pages, index and media references
src/services/answer-service.ts page selection, answering and group replies
scripts/build-wiki.mjs        bundles wiki/pages into src/wiki/generated-pages.ts
tests/                        Vitest unit tests
docs/modules/                 module docs
test_cases/                   test case documents
```

Coding standards and commit rules are in [AGENTS.md](AGENTS.md).

## Known Limitations

- Not yet verified in a real QQ group: whether text and media can share one message, whether media replies count toward the 5 passive replies, media size limits, and whether QQ can fetch files from a `workers.dev` domain.
- Callback URL validation (op 13) accepts the unsigned challenge documented by QQ and returns a signed response.
- Staying inside the wiki is enforced by the prompt and by page selection; a model can still occasionally phrase things beyond the source text.
- A personal developer bot cannot be listed publicly and can only join groups you own or manage.

## License

Proprietary. For personal use only.
