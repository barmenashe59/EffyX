// EffyX agent gateway: /api/agent
// The only place that talks to the AI provider. The browser never sees the API key.
// Requirements (decisions of 21.11.2026, to be numbered in the PRD):
//   R1 anyone signs in with Google, no Claude account needed
//   R3 pilot capped at 20 users
//   R4 per user per month: 2 EffyX CV versions, 2 practice sessions, hard stop
//   R5 Claude only: Sonnet for CV work, Haiku for everything else; total spend <= $10/month
//   R6 secrets live only in Netlify environment variables

// ---- Reference values: the one place to change limits, models and prices ----
const CONFIG = {
  pilotSeats: 20,
  monthly: { cv: 2, practice: 2 },
  userMonthlyUsd: 0.45, // backstop per user: 20 users x 0.45 < $10
  models: { cv: "claude-sonnet-5-5", default: "claude-haiku-5-5" },
  pricePerMTok: {
    "claude-sonnet-5-5": { in: 2, out: 10 },
    "claude-haiku-5-5": { in: 0.1, out: 0.5 },
  },
  maxOutputTokens: 2500,
  maxInputChars: 60000,
};

const SB_URL = "https://hnxzrcwpkyvqymvfowqh.supabase.co";
const SB_PUBLISHABLE = "sb_publishable_3WdvWrQsMNK3KzOu7I3xkg_C8f6dl2r";

const json = (status, obj) =>
  new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json" } });
const fail = (status, code) => json(status, { ok: false, error: code });

function month() {
  return new Date().toISOString().slice(0, 7);
}

// ---- Data layer (Supabase REST with the server secret key; RLS blocks everyone else) ----
function admin(path, init = {}) {
  return fetch(`${SB_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: process.env.SUPABASE_SECRET_KEY,
      "content-type": "application/json",
      ...(init.headers || {}),
    },
  });
}

async function getUser(req) {
  const auth = req.headers.get("authorization") || "";
  if (!auth.startsWith("Bearer ")) return null;
  const r = await fetch(`${SB_URL}/auth/v1/user`, {
    headers: { apikey: SB_PUBLISHABLE, authorization: auth },
  });
  if (!r.ok) return null;
  const u = await r.json();
  return u && u.id ? u : null;
}

// R3: first 20 users who sign in get a seat; everyone after that is refused.
async function claimSeat(user) {
  const mine = await admin(`pilot_members?user_id=eq.${user.id}&select=user_id`);
  if (!mine.ok) throw new Error("db_seat_read");
  if ((await mine.json()).length) return true;
  const count = await admin("pilot_members?select=user_id", {
    method: "HEAD",
    headers: { prefer: "count=exact" },
  });
  const total = Number((count.headers.get("content-range") || "*/0").split("/")[1]) || 0;
  if (total >= CONFIG.pilotSeats) return false;
  const ins = await admin("pilot_members", {
    method: "POST",
    headers: { prefer: "resolution=ignore-duplicates" },
    body: JSON.stringify({ user_id: user.id, email: user.email || null }),
  });
  if (!ins.ok) throw new Error("db_seat_write");
  return true;
}

async function readUsage(userId, m) {
  const r = await admin(`usage?user_id=eq.${userId}&month=eq.${m}&select=cv,practice_sessions,usd`);
  if (!r.ok) throw new Error("db_usage_read");
  const rows = await r.json();
  return rows[0] || { cv: 0, practice_sessions: [], usd: 0 };
}

async function writeUsage(userId, m, u) {
  const r = await admin("usage", {
    method: "POST",
    headers: { prefer: "resolution=merge-duplicates" },
    body: JSON.stringify({ user_id: userId, month: m, ...u }),
  });
  if (!r.ok) console.error("usage write failed", r.status, await r.text());
}

// R4 + backstop: decide before spending anything.
function checkLimits(usage, purpose, session) {
  if (Number(usage.usd) >= CONFIG.userMonthlyUsd) return "limit_monthly";
  if (purpose === "cv" && usage.cv >= CONFIG.monthly.cv) return "limit_cv";
  if (purpose === "practice") {
    const s = usage.practice_sessions || [];
    if (!s.includes(session) && s.length >= CONFIG.monthly.practice) return "limit_practice";
  }
  return null;
}

function cleanMessages(messages) {
  if (!Array.isArray(messages) || !messages.length) return null;
  let chars = 0;
  const out = [];
  for (const m of messages) {
    if (!m || (m.role !== "user" && m.role !== "assistant") || typeof m.content !== "string") return null;
    chars += m.content.length;
    out.push({ role: m.role, content: m.content });
  }
  if (chars > CONFIG.maxInputChars || out[0].role !== "user") return null;
  return out;
}

// ---- AI layer: Claude, streamed back to the browser as plain text ----
async function streamClaude(model, messages, onDone) {
  const upstream = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({ model, max_tokens: CONFIG.maxOutputTokens, messages, stream: true }),
  });
  if (!upstream.ok || !upstream.body) {
    const detail = await upstream.text().catch(() => "");
    console.error("anthropic error", upstream.status, detail.slice(0, 500));
    // 400 with "credit balance" = the prepaid $10 is used up
    const code = /credit/i.test(detail) ? "budget_exhausted" : upstream.status === 429 ? "rate_limited" : "ai_error";
    return fail(upstream.status === 429 ? 429 : 502, code);
  }
  const enc = new TextEncoder();
  const dec = new TextDecoder();
  let usage = { in: 0, out: 0 };
  const body = new ReadableStream({
    async start(controller) {
      const reader = upstream.body.getReader();
      let buf = "";
      try {
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          let i;
          while ((i = buf.indexOf("\n")) >= 0) {
            const line = buf.slice(0, i).trim();
            buf = buf.slice(i + 1);
            if (!line.startsWith("data:")) continue;
            let ev;
            try { ev = JSON.parse(line.slice(5)); } catch { continue; }
            if (ev.type === "message_start") usage.in = ev.message?.usage?.input_tokens || 0;
            else if (ev.type === "message_delta") usage.out = ev.usage?.output_tokens || usage.out;
            else if (ev.type === "content_block_delta" && ev.delta?.type === "text_delta")
              controller.enqueue(enc.encode(ev.delta.text));
          }
        }
      } catch (e) {
        console.error("stream broke", e);
      }
      await onDone(usage).catch((e) => console.error("usage update", e));
      controller.close();
    },
  });
  return new Response(body, { headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" } });
}

export default async (req) => {
  if (req.method !== "POST") return fail(405, "method_not_allowed");
  if (!process.env.ANTHROPIC_API_KEY || !process.env.SUPABASE_SECRET_KEY) return fail(503, "not_configured");

  const user = await getUser(req);
  if (!user) return fail(401, "unauthorized");

  let body;
  try { body = await req.json(); } catch { return fail(400, "bad_request"); }

  try {
    if (!(await claimSeat(user))) return fail(403, "pilot_full");
  } catch (e) {
    console.error(e);
    return fail(500, "db_error");
  }
  if (body.action === "check") return json(200, { ok: true, data: { seat: true } });

  const purpose = body.purpose === "cv" || body.purpose === "practice" ? body.purpose : "chat";
  const session = typeof body.session === "string" ? body.session.slice(0, 40) : "";
  if (purpose === "practice" && !session) return fail(400, "bad_request");
  const messages = cleanMessages(body.messages);
  if (!messages) return fail(400, "bad_request");

  const m = month();
  let usage;
  try { usage = await readUsage(user.id, m); } catch (e) { console.error(e); return fail(500, "db_error"); }
  const blocked = checkLimits(usage, purpose, session);
  if (blocked) return fail(429, blocked);

  const model = purpose === "cv" ? CONFIG.models.cv : CONFIG.models.default;
  return streamClaude(model, messages, async (tok) => {
    const p = CONFIG.pricePerMTok[model];
    const cost = (tok.in * p.in + tok.out * p.out) / 1e6;
    const fresh = await readUsage(user.id, m);
    const sessions = fresh.practice_sessions || [];
    await writeUsage(user.id, m, {
      cv: fresh.cv + (purpose === "cv" && tok.out > 0 ? 1 : 0),
      practice_sessions: purpose === "practice" && !sessions.includes(session) ? sessions.concat(session) : sessions,
      usd: Number(fresh.usd) + cost,
    });
  });
};

export const config = { path: "/api/agent" };
