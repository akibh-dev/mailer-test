# mailer-test

Single-page smoke tester for the [`mailer`](../mailerv2) email service worker.
A tiny Cloudflare Worker that renders a form and forwards it to the `mailer`
worker through a **service binding** — exactly how production consumers will
call it.

```
Browser → mailer-test worker → MAILER binding → mailer worker → Resend / Brevo / …
```

## Deploy order (important)

The binding points at the worker named `mailer`; it must exist first.

1. **Deploy the mailer** (see `mailerv2/README.md`) — dashboard
   (Workers Builds, root dir `mailer`) or `cd mailer && npx wrangler deploy`.
   Add at least one provider API key as a Secret on the mailer worker
   (dashboard → **mailer → Settings → Variables and Secrets**, or
   `npx wrangler secret put RESEND_API_KEY`).
2. **Connect this repo** in the Cloudflare dashboard:
   **Workers & Pages → Create → Connect to Git** → pick this repo →
   - Root directory: `/` (repo root)
   - Deploy command: `npx wrangler deploy` (default)
   The `MAILER` service binding is declared in `wrangler.jsonc`, so no manual
   binding setup is needed — deploys apply it automatically.
   (Or skip the dashboard: `npx wrangler deploy` from this folder.)
3. Open the deploy URL (workers.dev link is printed after deploy) and send
   yourself a test email.

## What the page shows

On success: the mailgrid result — which **provider** delivered, the message
**id**, every attempt made, and whether a **failover** happened.
On failure: the mailer's structured error (`quota_exhausted`,
`all_providers_failed` with a per-attempt summary, …).

## Local notes

`npm run dev` starts only this worker; without an account-level binding the
mailer isn't reachable locally, so use deploys or unit-free manual testing of
`mailer` itself from its own repo. `npm run check` runs typecheck + bundle.
