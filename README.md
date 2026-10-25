# mailer-test

Single-page smoke tester for the [`mailer`](../mailerv2) email API worker.
A tiny Cloudflare Worker that renders a form and forwards it to the mailer
worker over **plain HTTP** with a bearer key — no service bindings, no helper
packages, exactly the architecture of the API itself.

```
Browser → mailer-test worker --HTTP--> mailer.<subdomain>.workers.dev/send → providers
```

## Setup (order matters)

1. **Deploy the mailer first** (see `mailerv2/mailer/README.md`) and note its
   public URL, e.g. `https://mailer.your-subdomain.workers.dev`.
2. Set the mailer worker's Secrets:
   - provider key(s) (`RESEND_API_KEY` … any subset)
   - `MAILER_API_KEY` — any long random string, e.g.
     `openssl rand -hex 24`
3. On **this** worker, configure the client:
   - `MAILER_URL` = the mailer's public URL (a plain Variable in
     `wrangler.jsonc` or the dashboard)
   - `MAILER_API_KEY` = the same value (a Secret — dashboard →
     **Workers & Pages → mailer-test → Settings → Variables and Secrets**)
4. Deploy this repo from the dashboard (Workers Builds, root dir `/`) or
   `npx wrangler deploy`.
5. Open the deploy URL and send a test email.

The result box shows the mailgrid output: which **provider** delivered, the
message **id**, every **attempt**, whether **failover** happened — or the
mailer's structured error (`invalid_api_key`, `quota_exhausted`,
`all_providers_failed`, …).

## Local notes

```bash
cp .dev.vars.example .dev.vars   # MAILER_URL + MAILER_API_KEY (dev values)
npm run dev
```

`npm run check` runs typecheck + bundle. `.dev.vars` is git-ignored.
