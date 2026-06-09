# EffyX

**AI career agent for high-tech sales.** Pre-launch landing page + waitlist.

EffyX runs your job search like a sales pipeline — sourcing the right roles, tailoring
every application, opening doors with hiring managers, and tracking it all on one board.

A single, dependency-free `index.html` (HTML + CSS + vanilla JS). No build step.

---

## Run locally

With Node (Claude Code already requires it):

```bash
npm run dev        # uses `npx serve`
```

Or with nothing but Python:

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

Or just open `index.html` in a browser.

---

## ⚠️ The waitlist needs a real backend before launch

The form currently uses `window.storage`, the Claude.ai Artifacts storage API. **It only
works inside the Claude.ai artifact sandbox.** Run it locally or deploy it as-is and the
form will still validate and show the "you're on the list" state, but **signups are not
saved or collected** — it silently falls back to in-memory storage.

To collect real emails, rewire the submit handler in the `<script>` at the bottom of
`index.html` (`handleSubmit()` + the `sget`/`sset` helpers) to POST to one of:

| Option | Good for |
| --- | --- |
| **Formspree / Basin / Tally** | Fastest — drop-in form endpoint, no server |
| **ConvertKit / Mailchimp / Loops** | If you want the emails in an email tool from day one |
| **Supabase / Firebase** | If you want a real DB you control |
| **Serverless function** (Vercel/Netlify) | Custom logic, your own storage |

Keep the email validation, the seat-meter updates (`data-claimed` / `data-seats` /
`data-bar`), and the joined-state UI when you swap it.

---

## Deploy

Static site — host anywhere:

- **Netlify / Vercel:** drag-and-drop the folder, or connect the repo. Zero config.
- **GitHub Pages:** push to a repo, enable Pages on the branch.
- **Cloudflare Pages:** connect repo, no build command needed.

Then point a custom domain at it.

Don't forget to add a favicon and OpenGraph/Twitter meta tags so shared links look sharp.

---

## Roadmap

- [ ] Real waitlist backend (see above)
- [ ] Hebrew (RTL) version + EN/HE toggle
- [ ] Analytics + submit conversion tracking
- [ ] Favicon + social share/meta tags
- [ ] Deploy + custom domain

See `CLAUDE.md` for the full design system, brand voice, and architecture notes.

---

Built with Claude. `CLAUDE.md` gives Claude Code everything it needs to keep iterating in style.
