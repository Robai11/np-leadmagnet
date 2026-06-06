# ConversionScan

A public CRO lead-magnet web app. A visitor enters a shop URL plus context; the
tool scans the e-commerce funnel (home → category → product → cart → checkout),
marks the biggest conversion levers directly on screenshots of the pages, and
shows an uplift hypothesis. A standalone uplift calculator sits below the report.

Built per `conversionscan-build-spec.md`, structurally faithful to the
`cro-analyzer-prototype` click-prototype.

---

## Run it locally (no keys needed)

```bash
nvm use --lts          # Node 20.9+ required (Next.js 16)
npm install
npm run dev            # http://localhost:3000
```

Without any API keys the app runs on the **mock pipeline** — the full UX
(form → streamed loading → teaser → email-gate → unlock → report → calculator)
works end-to-end with curated mock findings. This is the default and always
works.

`npm run build` produces the production build; `npm start` serves it.

---

## Going live — the three keys

The real analysis (headless browser render + Claude Vision) needs three
services. Copy `.env.example` to `.env.local` and fill them in. The app
automatically switches from mock to the real pipeline once
`BROWSERBASE_API_KEY` **and** `ANTHROPIC_API_KEY` are present.

| Variable | What it's for | Where to get it |
|---|---|---|
| `ANTHROPIC_API_KEY` | Claude with Vision analyzes each page screenshot. | console.anthropic.com → API keys. Pay-as-you-go. |
| `BROWSERBASE_API_KEY` (+ `BROWSERBASE_PROJECT_ID`) | A hosted headless browser that renders the shop, dismisses consent banners, scrolls for lazy-loading, screenshots, and walks the cart/checkout. | browserbase.com → sign up → Settings. Free tier to start. |
| `BLOB_READ_WRITE_TOKEN` | Persists screenshots so reports stay reachable. **Optional** — without it, screenshots are inlined as data URLs (fine for local dev). | Vercel project → Storage → Blob. |
| `ANTHROPIC_MODEL` | Optional override. Defaults to `claude-opus-4-8`; set `claude-sonnet-4-6` to cut Vision cost. | — |

Nothing else changes when you add keys — same UI, same API contract. If the
keys are wrong or a step fails, the run degrades honestly (unreachable pages are
reported as notes, never invented) rather than breaking.

---

## How it works

```
Landing form ──▶ POST /api/analyze (NDJSON stream)
                   │  rate-limit per IP · normalize URL · cache per URL
                   │  pipeline (real if keys, else mock):
                   │    discover page types (sitemap → nav fallback)
                   │    render read-only pages in parallel sessions
                   │      (desktop 1280 + mobile 390, consent, lazy-load,
                   │       full-page screenshot + element enumeration w/ bbox)
                   │    Vision: 1 structured call/page, findings bound to
                   │      a real element; pins from the real bbox, not guessed
                   │    stateful PDP→cart→checkout (stop before any data entry)
                   │    score pages · capped/blended overall uplift (never a sum)
                   ▼
              gate: redact locked prose, stream teaser only ──▶ client report
                   ▲
POST /api/unlock (email) ── returns the full server-held report + captures lead
```

- **Brand tokens** live only in `src/styles/tokens.css` (+ typed accessors in
  `src/styles/tokens.ts`). Rebranding is a one-file swap; no hex or font name
  appears anywhere else. Token *names* follow the build-spec; the *values* are
  the prototype's placeholders until real brand values are dropped in.
- **The email gate is real.** Locked findings stay server-side; the stream
  carries only the single teaser lever's prose. No CSS-blur of hidden content.
- **Calculator** is fully client-side and independent of the analysis.

### Key files

| Area | Path |
|---|---|
| Brand tokens (rebrand here) | `src/styles/tokens.css`, `src/styles/tokens.ts` |
| Analysis schema (§4) | `src/lib/types.ts` |
| Rubric (§5/§6 impact+range bands) | `src/lib/rubric.ts` |
| Scoring + capped overall uplift (§6/§7) | `src/lib/scoring.ts` |
| Streaming protocol | `src/lib/analysis/events.ts` |
| Mock pipeline | `src/lib/analysis/mock.ts` |
| Real pipeline (browser + Vision) | `src/lib/analysis/{real,browser,discovery,render,stateful,vision,blob}.ts` |
| Email gate (server-side redaction) | `src/lib/analysis/gate.ts` |
| API routes | `src/app/api/{analyze,unlock,lead}/route.ts` |
| UI | `src/components/*` |

---

## Ops & cost

- **Per run:** up to ~5 Vision calls + one multi-step browser session. The
  stateful session is the latency axis — read-only pages render in parallel and
  results stream in as they complete.
- **Caching** is per normalized URL (in-memory, 24h). **Rate-limiting** is per
  IP (in-memory, 5/h). Both are per-instance; swap in Vercel KV / Redis for a
  durable shared store (same interfaces in `src/lib/cache.ts` /
  `src/lib/rate-limit.ts`).
- **Prompt caching:** the Vision system prompt/rubric is cached, so the ~5 page
  calls in a run (and across runs) reuse it.
- **Lead sink** (`src/lib/lead-sink.ts`) currently logs + appends to
  `.data/leads.jsonl`. Implement `LeadSink` and swap the export to wire a CRM
  (e.g. HubSpot with email + industry/device/channels as contact properties).

---

## Status

All milestones implemented. The mock path is verified end-to-end (UI, stream,
cache, rate-limit, server-side gate, unlock, lead capture). The real
browser + Vision path builds and type-checks; it needs the keys above to run
against a live shop.
