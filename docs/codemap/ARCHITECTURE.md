# Architecture — flori-site (Floria)

**What it is:** a flower shop landing page with a request form, plus the owner's CRM (sales funnel, cards, history), Telegram notifications and Mini App, business-card scanning, catalog image generation, an ElevenLabs voice agent, an MCP server and PDF invoices. Next.js 15 (App Router) + Supabase, deployed on Vercel.

## Top-level structure

| Path | Contents |
|---|---|
| `app/page.tsx` | Landing page + request form |
| `app/login` | Owner login (Supabase Auth) |
| `app/admin/**` | CRM: funnel board, client card `[id]`, manual add `new`, business-card `scan`, image `generate`, invoice PDF download, original scan file |
| `app/tg` | Telegram Mini App: bouquet catalog and order |
| `app/api/*` | Server endpoints (see below) |
| `lib/*.ts` | Server logic per feature; `lib/supabase/` — Supabase clients; `lib/fonts/` — Noto Sans for PDFs |
| `middleware.ts` | Refreshes the session; redirects `/admin` to `/login` without a user |
| `supabase/schema.sql`, `supabase/migrations/` | DB schema and numbered migrations (applied by hand in the SQL Editor) |
| `scripts/create-voice-agent.mjs` | Creates the ElevenLabs voice agent |

## Entry points (HTTP)

| Route | Purpose | Access |
|---|---|---|
| `POST /api/requests` | Site request → DB (stage «Новая», source «Сайт») + Telegram | public, validated |
| `POST /api/scan`, `/api/scan/save` | Business card → Claude extraction → client in funnel | owner |
| `POST /api/generate` | Catalog/post images (Gemini), 5 per 24 h | owner |
| `POST /api/tg/me`, `/api/tg/order` | Telegram Mini App user and order | Telegram initData signature |
| `GET /api/telegram-check` | Telegram bot check | — |
| `POST /api/voice-lead` | Lead from the ElevenLabs voice agent (source «Голос») | `X-Voice-Secret` |
| `GET/POST/DELETE /api/mcp` | CRM MCP server: list_requests, find_client, change_stage | `Bearer MCP_TOKEN` |
| `GET /admin/invoices/[invoiceId]` | Invoice PDF from private storage | owner |

## Domains

| Domain | Logic | UI / API |
|---|---|---|
| Requests & funnel | `lib/requests.ts`, migration `002_crm.sql` (stage history trigger) | `app/admin`, `app/admin/[id]`, `/api/requests` |
| Business cards | `lib/scan.ts`, `003_business_cards.sql` | `app/admin/scan`, `/api/scan*` |
| Telegram | `lib/telegram.ts`, `lib/telegram-auth.ts`, `004_telegram.sql` | `app/tg`, `/api/tg/*` |
| Image generation | `lib/imagegen.ts`, `lib/imagegen-usage.ts`, `lib/image-client.ts`, `005_image_generations.sql` | `app/admin/generate`, `/api/generate` |
| Voice agent | `lib/voice.ts`, `006_voice.sql` | `/api/voice-lead` |
| MCP | `007_mcp.sql` | `/api/mcp` |
| Invoices | `lib/invoices.ts`, `lib/invoice-pdf.ts`, `lib/company.ts` (demo requisites), `lib/catalog.ts`, `008_invoices.sql` | client card «Счета», `/admin/invoices/[invoiceId]` |

## Cross-cutting patterns

- **Auth:** one owner via Supabase Auth; `middleware.ts` guards `/admin`; RLS closes all tables to the anon key. Machine endpoints check their own secret.
- **Secrets:** only in env (`.env.local` locally, Vercel dashboard in prod); never in code.
- **DB changes:** a new numbered file in `supabase/migrations/`; the user applies it by hand.

## Where to add

- **New endpoint** → `app/api/<name>/route.ts`, logic in `lib/<name>.ts`, check the caller (session or secret).
- **New admin page** → `app/admin/<name>/page.tsx` (protected by `middleware.ts` automatically).
- **New table/column** → `supabase/migrations/00N_<name>.sql` with RLS policies; tell the user to run it in the SQL Editor.
- **Tests** → no test framework yet.
