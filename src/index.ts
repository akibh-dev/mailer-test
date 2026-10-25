// mailer-test — single-page smoke-test consumer for the `mailerv2` service
// worker. Deployed as a separate worker with a service binding:
//
//   "services": [{ "binding": "MAILER", "service": "mailerv2" }]
//
// The binding is Cloudflare-internal: no public mailer URL, no auth.
//
// GET  /      → test page (recipient/subject/body form)
// POST /send  → forwards the form payload through the MAILER binding,
//               returns the mailgrid SendResult as JSON.

/** Minimal structural type for the service binding. */
export interface MailerBinding {
  fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
}

export interface MailerErrorBody {
  error: string;
  message?: string;
  summary?: string;
  hint?: string;
}

export class MailerSendError extends Error {
  readonly status: number;
  readonly code: string;
  readonly body: MailerErrorBody;

  constructor(status: number, body: MailerErrorBody) {
    super(body.message ?? body.summary ?? body.error);
    this.name = "MailerSendError";
    this.status = status;
    this.code = body.error;
    this.body = body;
  }
}

interface SendEmailInput {
  to: string | string[];
  subject: string;
  text?: string;
  html?: string;
  idempotencyKey?: string;
  [key: string]: unknown;
}

interface SendResult {
  status: string;
  id: string;
  provider: string;
  attempts: {
    provider: string;
    ok: boolean;
    status?: number;
    error?: string;
    durationMs: number;
  }[];
  usedFallback: boolean;
  durationMs: number;
}

async function sendMail(mailer: MailerBinding, input: SendEmailInput): Promise<SendResult> {
  // URL is a placeholder: service bindings route on the binding, not the host.
  const res = await mailer.fetch("https://mailer.internal/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const body = (await res.json()) as unknown;
  if (!res.ok) {
    throw new MailerSendError(res.status, body as MailerErrorBody);
  }
  return body as SendResult;
}

// ---------------------------------------------------------------------------
// Worker
// ---------------------------------------------------------------------------

const page = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Mailer test</title>
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body {
    margin: 0; min-height: 100vh; display: grid; place-items: center;
    font: 15px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif;
    background: #0b0e14; color: #e6e9ef;
  }
  main { width: min(92vw, 480px); }
  h1 { font-size: 1.25rem; margin: 0 0 4px; }
  p.sub { margin: 0 0 24px; color: #8b93a7; font-size: .9rem; }
  form { display: grid; gap: 14px; }
  label { display: grid; gap: 6px; font-size: .8rem; color: #aab2c5; }
  input, textarea {
    background: #151a23; color: #e6e9ef; border: 1px solid #2a3242;
    border-radius: 8px; padding: 10px 12px; font: inherit; width: 100%;
  }
  input:focus, textarea:focus { outline: none; border-color: #57b5ff; }
  textarea { min-height: 90px; resize: vertical; }
  button {
    background: #2f6fff; color: #fff; border: 0; border-radius: 8px;
    padding: 10px 16px; font: inherit; font-weight: 600; cursor: pointer;
  }
  button:disabled { opacity: .6; cursor: wait; }
  #result {
    margin-top: 22px; display: none; border-radius: 8px; padding: 14px 16px;
    background: #101725; border: 1px solid #2a3242; white-space: pre-wrap;
    font: 12.5px/1.6 ui-monospace, monospace; overflow-wrap: anywhere;
  }
  #result.ok { border-color: #1f7a4d; }
  #result.err { border-color: #a03434; }
</style>
</head>
<body>
<main>
  <h1>Mailer test</h1>
  <p class="sub">Calls the <code>mailerv2</code> worker over its internal service binding — mailgrid routes across your configured providers.</p>
  <form id="f">
    <label>From — sender address, e.g. noreply@yourdomain.com
      <input name="from" type="email" placeholder="noreply@yourdomain.com">
    </label>
    <label>To
      <input name="to" type="email" placeholder="you@example.com" required>
    </label>
    <label>Subject
      <input name="subject" placeholder="Hello from mailer-test" required>
    </label>
    <label>Message
      <textarea name="text" placeholder="Plain text body. HTML is derived from it." required></textarea>
    </label>
    <button id="go" type="submit">Send test email</button>
  </form>
  <div id="result"></div>
</main>
<script>
  const f = document.getElementById("f");
  const go = document.getElementById("go");
  const out = document.getElementById("result");
  f.addEventListener("submit", async (e) => {
    e.preventDefault();
    go.disabled = true;
    out.style.display = "block";
    out.className = "";
    out.textContent = "Sending...";
    try {
      const d = new FormData(f);
      const payload: Record<string, unknown> = {
        to: d.get("to"),
        subject: d.get("subject"),
        text: d.get("text"),
      };
      const from = d.get("from");
      if (from) payload.from = from;
      const res = await fetch("/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await res.json();
      out.className = res.ok ? "ok" : "err";
      out.textContent = res.ok
        ? "Sent via " + body.provider + " (id " + body.id + ")" +
          (body.usedFallback ? " — after failover" : "") + "\\n\\n" +
          JSON.stringify(body, null, 2)
        : "Error " + res.status + ": " + (body.error || "unknown") + "\\n\\n" +
          (body.summary || body.message || JSON.stringify(body, null, 2));
    } catch (err) {
      out.className = "err";
      out.textContent = "Request failed: " + err;
    } finally {
      go.disabled = false;
    }
  });
</script>
</body>
</html>`;

const html = (body: string, status = 200) =>
  new Response(body, { status, headers: { "content-type": "text/html; charset=utf-8" } });

export interface Env {
  MAILER: MailerBinding;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/") {
      return html(page);
    }

    if (request.method === "POST" && url.pathname === "/send") {
      let form: { to?: unknown; from?: unknown; subject?: unknown; text?: unknown };
      try {
        form = (await request.json()) as typeof form;
      } catch {
        return Response.json({ error: "invalid_json" }, { status: 400 });
      }
      const to = typeof form.to === "string" ? form.to.trim() : "";
      const subject = typeof form.subject === "string" ? form.subject.trim() : "";
      const text = typeof form.text === "string" ? form.text.trim() : "";
      const from = typeof form.from === "string" ? form.from.trim() : "";
      if (!to || !subject || !text) {
        return Response.json(
          { error: "missing_fields", message: "to, subject and text are required." },
          { status: 400 },
        );
      }
      try {
        // `from` is optional here: if omitted, the mailer falls back to its
        // EMAIL_DEFAULT_FROM secret (or returns 400 invalid_message if that
        // secret isn't set either).
        const result = await sendMail(env.MAILER, from ? { from, to, subject, text } : { to, subject, text });
        return Response.json(result);
      } catch (error) {
        if (error instanceof MailerSendError) {
          return Response.json(error.body, { status: error.status });
        }
        return Response.json(
          { error: "internal_error", message: String(error) },
          { status: 500 },
        );
      }
    }

    return Response.json({ error: "not_found" }, { status: 404 });
  },
} satisfies ExportedHandler<Env>;
