// EffyX runtime: gives agent.html the same three services it had inside Claude
// (db, user, sample), backed by Supabase (sign-in + data) and /api/agent (Claude).
// Swap this file to move platforms; agent.html does not change.
(function () {
  var SB_URL = "https://hnxzrcwpkyvqymvfowqh.supabase.co";
  var SB_KEY = "sb_publishable_3WdvWrQsMNK3KzOu7I3xkg_C8f6dl2r";
  var sb = window.supabase.createClient(SB_URL, SB_KEY);

  async function session() {
    var r = await sb.auth.getSession();
    return r.data.session;
  }

  // Each saved item (profile, cv, practice...) is one row, visible only to its owner (RLS).
  var db = {
    doc: function (path) {
      var key = String(path).split("/").pop();
      return {
        get: async function () {
          var r = await sb.from("workspace").select("data").eq("key", key).maybeSingle();
          if (r.error) throw r.error;
          return { data: function () { return r.data ? r.data.data : null; } };
        },
        set: async function (value) {
          var s = await session();
          if (!s) throw new Error("signed_out");
          var r = await sb.from("workspace").upsert({
            user_id: s.user.id, key: key, data: value, updated_at: new Date().toISOString()
          });
          if (r.error) throw r.error;
        }
      };
    }
  };

  var user = { id: async function () { var s = await session(); return s ? s.user.id : null; } };

  async function call(payload, signal) {
    var s = await session();
    if (!s) { var e0 = new Error("unauthorized"); e0.code = "unauthorized"; throw e0; }
    var res = await fetch("/api/agent", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: "Bearer " + s.access_token },
      body: JSON.stringify(payload),
      signal: signal
    });
    if (!res.ok) {
      var j = {}; try { j = await res.json(); } catch (x) {}
      var e = new Error(j.error || "ai_error"); e.code = j.error || "ai_error"; throw e;
    }
    return res;
  }

  async function sample(messages, opts) {
    opts = opts || {};
    var res = await call({ messages: messages, purpose: opts.purpose, session: opts.session }, opts.signal);
    var reader = res.body.getReader(), dec = new TextDecoder(), text = "";
    for (;;) {
      var step = await reader.read();
      if (step.done) break;
      text += dec.decode(step.value, { stream: true });
      if (opts.onText) opts.onText({ text: text });
    }
    if (!text) { var e = new Error("ai_error"); e.code = "ai_error"; throw e; }
    return { text: text };
  }

  function parseJSON(t) {
    var s = t.replace(/```(?:json)?/g, "");
    var a = s.indexOf("{"), b = s.lastIndexOf("}");
    if (a < 0 || b < a) throw Object.assign(new Error("bad_json"), { code: "ai_error" });
    return JSON.parse(s.slice(a, b + 1));
  }

  sample.json = async function (prompt, opts) {
    var r = await sample([{ role: "user", content: prompt + "\n\nReturn valid JSON only, with no text before or after it." }], opts);
    return parseJSON(r.text);
  };


  // Google's own sign-in button (Google Identity Services). Google then shows
  // "effyx.netlify.app" to the user instead of the Supabase address.
  var GOOGLE_CLIENT_ID = "743802344953-nceh1kk27664gi7hdqjnhntba0djejgd.apps.googleusercontent.com";
  function loadGis() {
    return new Promise(function (ok, bad) {
      if (window.google && google.accounts && google.accounts.id) return ok();
      var t = document.createElement("script");
      t.src = "https://accounts.google.com/gsi/client"; t.async = true;
      t.onload = ok; t.onerror = bad; document.head.appendChild(t);
    });
  }
  async function sha256hex(str) {
    var buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
    return Array.from(new Uint8Array(buf)).map(function (b) { return b.toString(16).padStart(2, "0"); }).join("");
  }
  async function googleButton(el, onError) {
    await loadGis();
    var raw = Array.from(crypto.getRandomValues(new Uint8Array(24))).map(function (b) { return b.toString(16).padStart(2, "0"); }).join("");
    var hashed = await sha256hex(raw);
    google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      nonce: hashed,
      use_fedcm_for_prompt: true,
      callback: async function (resp) {
        var r = await sb.auth.signInWithIdToken({ provider: "google", token: resp.credential, nonce: raw });
        if (r.error) { if (onError) onError(r.error); return; }
        location.reload();
      }
    });
    google.accounts.id.renderButton(el, {
      type: "standard", theme: "outline", size: "large", text: "continue_with",
      shape: "rectangular", logo_alignment: "center", width: Math.min(el.clientWidth || 356, 400)
    });
  }

  window.effyx = {
    blockReason: null,
    signIn: function () {
      return sb.auth.signInWithOAuth({ provider: "google", options: { redirectTo: location.origin + "/agent.html" } });
    },
    googleButton: googleButton,
    signInEmail: function (email) {
      return sb.auth.signInWithOtp({ email: email, options: { emailRedirectTo: location.origin + "/agent.html" } });
    },
    signOut: async function () { await sb.auth.signOut(); location.reload(); }
  };

  // Same shape agent.html used inside Claude: window.claude.use("db" | "user" | "sample")
  window.claude = {
    use: async function (name) {
      if (name === "db") return db;
      if (name === "sample") return sample;
      if (name === "user") {
        var s = await session();
        if (!s) { window.effyx.blockReason = "signed_out"; return null; }
        try { await (await call({ action: "check" })).json(); }
        catch (e) { window.effyx.blockReason = e.code || "error"; return null; }
        return user;
      }
      return null;
    }
  };
})();
