# mailer-test

Single-page smoke tester for the [`mailer`](../mailerv2) email service
worker. A tiny Cloudflare Worker that renders a form and forwards it to the
`mailer` worker through its **service binding** — the same
Cloudflare-internal path production consumers use. The mailer has no public
URL; only workers in the account can reach it. (Only this test page itself
gets a public workers.dev URL so you can open it in a browser.)

```
Browser → mailer-test worker → MAILER binding (internal) → mailer → providers
```

## Deploy order (important)

The binding points at the worker named `mailerv2`; it must exist first.

1. **Deploy the mailer** (see `mailerv2/README.md`) — dashboard
   (Workers Builds, repo root `/` — the worker is the whole `mailerv2`
   repo) or `cd mailerv2 && npx wrangler deploy`.
   Add at least one provider API key as a Secret on the mailer worker
   (dashboard → **mailerv2 → Settings → Variables and Secrets**, or
   `npx wrangler secret put RESEND_API_KEY`).
   **Optional:** set `EMAIL_DEFAULT_FROM` on the mailer as well, and the
   test page's From field can then be left empty.
2. **Connect this repo** in the Cloudflare dashboard:
   **Workers & Pages → Create → Connect to Git** → pick this repo →
   - Root directory: `/` (repo root)
   - Deploy command: `npx wrangler deploy` (default)
The `MAILER` service binding is declared in `wrangler.jsonc` via
`unsafe.bindings` (service type, `service: mailerv2`, environment
`production`, entrypoint `default`), so no manual binding setup is needed.
No secrets or vars are required here.
   (Or skip the dashboard: `npx wrangler deploy` from this folder.)
3. Open the deploy URL (workers.dev link printed after deploy) and send
   yourself a test email.

## What the page shows

On success: the mailgrid result — which **provider** delivered, the message
**id**, every **attempt**, whether **failover** happened.
On failure: the mailer's structured error (`quota_exhausted`,
`all_providers_failed` with a per-attempt summary, `invalid_message` …).

`Error 400: invalid_message — Missing 'from' address` means no From was
filled in **and** the mailer's `EMAIL_DEFAULT_FROM` secret is not set.
Set EMAIL_DEFAULT_FROM on the mailerv2 worker (recommended), or fill the
From input on the page.

## Local notes

`npm run dev` starts only this worker; the mailerv2 service binding needs a
running mailer (`wrangler dev` with both configs, or just deployed state)
to answer /send. `npm run check` runs typecheck + bundle.
