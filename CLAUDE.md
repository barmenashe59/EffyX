# CLAUDE.md

Project context for Claude Code. Read this before making changes.

## What this is

**Caliber** — marketing landing page + waitlist for an AI *career agent* built for
high-tech sales professionals (AEs, RVPs, SDR leaders, etc.). The product premise:
run a job search like a sales pipeline. Caliber sources relevant roles, tailors every
application, drafts hiring-manager outreach, and tracks everything as a deal board.

This repo is currently the **pre-launch landing page only** (no product backend yet).

## Tech stack

- Plain **HTML + CSS + vanilla JS**, single file (`index.html`). No framework, no build step.
- Fonts loaded from Google Fonts via `<link>`.
- Keep it dependency-light. Do **not** introduce React/Vue/Tailwind/bundlers unless we
  explicitly decide to migrate (see Roadmap). If we do migrate, preserve the design system below.

## Run it locally

```bash
npm run dev        # serves the folder via `npx serve` on a local port
# or, no Node needed:
python3 -m http.server 8000   # then open http://localhost:8000
```

## ⚠️ Waitlist storage — read this

The waitlist uses `window.storage` (the Claude.ai Artifacts key-value API). That API
**only exists inside the Claude.ai artifact sandbox.** Anywhere else (local dev, a real
deploy) `window.storage` is undefined, and the code falls back to an **in-memory store**:
the form still validates and shows the success state, but signups are **not persisted**
and **not collected anywhere**.

**Before launch, replace the storage layer with a real backend.** The submit logic is
isolated in the `<script>` at the bottom of `index.html` — see `handleSubmit()` and the
`sget`/`sset` helpers. Swap those for a POST to one of:
- a no-code form endpoint (Formspree, Tally, Basin),
- an email tool (ConvertKit / Mailchimp / Loops API),
- or your own DB (Supabase / Firebase / a tiny serverless function).

Keep the existing email validation, the `data-claimed` / `data-seats` / `data-bar`
seat-meter updates, and the joined-state UI when you rewire it.

## Design system (keep on-brand)

Aesthetic: **precision luxury** — dark, refined, "President's Club" energy. Sharp, not flashy.

**Fonts**
- Display / headlines: `Instrument Serif` (elegant high-contrast serif; italic for accents)
- Body / UI: `Hanken Grotesk`
- Labels, eyebrows, numbers: `JetBrains Mono` (uppercase, wide letter-spacing)

**Color tokens** (defined as CSS variables in `:root`)
- `--bg` `#0a0908` (warm near-black), `--bg-2` `#0f0e0c`
- `--surface` `#141210`, `--surface-2` `#1b1814`
- `--bone` `#F3EEE3` (primary text), `--bone-dim` `#CBC4B6`, `--muted` `#8E877B`
- `--gold` `#D8B26A` (primary accent), `--gold-bright` `#EAC987`, `--gold-deep` `#B8924A`
- `--green` `#9FCB8B` (success/offer), `--blue` `#8FB7D6` (status)
- Hairlines: `--faint` / `--faint-2`

**Texture & motion**
- Fixed radial champagne glow + SVG film-grain overlay for depth.
- One orchestrated page-load reveal (staggered `animation-delay`) + `IntersectionObserver`
  scroll reveals on `.reveal` elements.
- All motion is gated behind `@media (prefers-reduced-motion: reduce)` — keep it that way.

**Voice / copy**
- Confident, concise, sales-literate. Reframes the job hunt as a deal you close.
- No fabricated metrics or fake logos. Scarcity framing ("first cohort, limited seats") is fine
  because the seat meter reflects real signups.

## Page structure (sections in `index.html`)

1. Fixed nav (transparent → blurred on scroll)
2. Hero — headline + email capture + live "pipeline" product glimpse card
3. Marquee ticker of high-tech sales segments
4. `#thesis` — positioning + 3-cell value row
5. `#how` — 4 numbered steps
6. `#features` — 6 capability cards with inline SVG icons
7. `#access` — primary waitlist CTA band (seat meter)
8. Footer

## Roadmap / good next tasks

- [ ] Replace `window.storage` waitlist with a real backend (see warning above).
- [ ] **Hebrew (RTL) version** — `dir="rtl"`, Hebrew copy, an RTL-friendly Hebrew display font;
      add a simple EN/HE language toggle.
- [ ] Add basic analytics (privacy-friendly, e.g. Plausible) + conversion tracking on submit.
- [ ] Deploy (Netlify / Vercel / GitHub Pages) and wire a custom domain.
- [ ] Add favicon, OpenGraph/Twitter meta tags + share image for link previews.
- [ ] Optional: split into a small component setup if scope grows (Astro is a good fit —
      static-first, keeps this vanilla feel).

## Conventions

- Accessibility: keep labels, `aria-live` on form feedback, visible focus states, reduced-motion.
- Don't hardcode colors — use the CSS variables.
- Sample data in the hero "pipeline" card is illustrative; keep company names generic/fictional.
