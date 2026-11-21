# CLAUDE.md

EffyX: an AI career agent that prepares sales people (field sales, insurance, course sellers, SDRs) to get hired into high-tech sales. English-only UI. Owner: Bar David Menashe.

## What is here (pilot, Nov 2026)

- `index.html`: marketing site (07.11 teal design). "Join the pilot" links to `agent.html`.
- `agent.html`: the candidate workspace (onboarding, CV, stories, stages, interview practice).
- `effyx-runtime.js`: gives `agent.html` three services: `db` (Supabase table `workspace`), `user` (Supabase Auth: Google + email link), `sample` (calls `/api/agent`). Swap this file to change platforms; `agent.html` stays the same.
- `netlify/functions/agent.mjs`: the only place that calls Claude. Holds all limits in `CONFIG` (20 pilot seats, 2 EffyX CV versions and 2 practice sessions per user per month, $0.45 per user per month backstop; Sonnet for CV, Haiku for the rest).
- `supabase/setup.sql`: tables `workspace` (RLS: owner only), `pilot_members`, `usage` (server only).
- `archive/june-2026/`: the old gold landing page. Do not use it as a source.

## Secrets

Only in Netlify environment variables: `ANTHROPIC_API_KEY`, `SUPABASE_SECRET_KEY`. Never in code or chat. The Supabase URL and publishable key are public and live in the code.

## Deploy

Netlify project `effyx` (effyx.netlify.app) deploys automatically from `main`. No build step.

## Design

Deep-teal "abyssal terminal": surfaces `--abyss #012624`, `--deep #011d1c`, `--kelp #003734`; aurora gradient for the primary action; DM Sans, medium weight; no shadows. Use the CSS variables.
