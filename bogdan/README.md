# bogdan/

Bogdan's (R3ktline) planning material for the adaptive storefront. It lives in this folder so each teammate's work can be merged into one layout later. **If you are the agent centralizing the repo, read this first.**

## What's here

| Path | What it is |
|---|---|
| `SPEC.md` | Product spec, architecture, repo layout (§7), scope (§8), team split (§10) |
| `CLAUDE.md` | Agent rules: non-negotiables, track ownership, git workflow |
| `docs/ANALYSIS.md` | Risks, competition, counterpoints |
| `docs/GUARDRAILS.md` | Safety layers and draft system prompts |
| `docs/DEMO.md` | Demo plan |
| `docs/PLANNING-NOTES.md` | Earlier exploration and alternatives |
| `docs/TASKS.md` | Task board with owners per track |
| `docs/DECISIONS.md` | Settled decisions plus open questions |
| `.github/` | CODEOWNERS, PR template, CI workflow |
| `.env.example` | Env vars for the DeepSeek client |

## Nothing in here is active yet

GitHub and coding agents only use these files at the repo root. Inside `bogdan/` they do nothing:

- `.github/` (CI, CODEOWNERS, PR template) is ignored by GitHub.
- `CLAUDE.md` isn't loaded automatically by agents working at the root.

Links between these files are relative and all moved together, so they still work.

`.gitignore` was kept at the **repo root** on purpose. If it moved into `bogdan/`, it would stop protecting `.env.local`, and a DeepSeek key could get committed. Don't move it.

## Steps to centralize

1. Move `CLAUDE.md`, `SPEC.md`, `docs/`, `.github/` and `.env.example` to the repo root.
2. Merge in the other teammates' folders. Where their material conflicts with `SPEC.md` or `docs/DECISIONS.md`, record the outcome in `DECISIONS.md` rather than silently picking one.
3. Check `.github/CODEOWNERS`. Its paths assume the root layout from SPEC §7. Every owner is `@R3ktline` until the others' GitHub usernames are known.
4. Check that the track owners in `CLAUDE.md` and `docs/TASKS.md` still match the team: A = R3ktline, B = Ionut, C = David, D = Estegucci.
5. Delete `bogdan/` once it's empty.
