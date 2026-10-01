# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # Start Express + Vite dev server (tsx server.ts) on http://localhost:3000
npm run build    # Production build via Vite (outputs to dist/)
npm run start    # Run built server in production mode (node --experimental-strip-types server.ts)
npm run preview  # Preview the Vite production build
npm run lint     # Type-check only (tsc --noEmit) — there is no separate test suite or linter config
npm run clean    # Remove dist/
```

There is no test framework configured in this repo. `npm run lint` (a `tsc --noEmit` type check) is the only automated correctness check.

## Architecture

This is a single-page React app ("AI Skill Creator") that uses the Gemini API to turn a natural-language use case into a complete [Agent Skill](https://www.anthropic.com/engineering/building-effective-agents) bundle (a `SKILL.md` file plus optional supporting scripts/references/assets), with Firebase for auth and persistence.

**Runtime split (`server.ts`):** A single Express server does double duty:
- `/api/config` returns the Gemini API key from `process.env.API_KEY` / `GEMINI_API_KEY` (used as a fallback when the client-side env var isn't injected, e.g. when not running inside AI Studio).
- In development, it mounts Vite as middleware (`middlewareMode: true`) so there's one process for both API and frontend.
- In production it serves the static `dist/` build and falls back to `index.html` for client-side routing.

**Gemini integration (`src/services/geminiService.ts`):** `createSkillChat()` builds a `@google/genai` chat session with a system instruction that encodes the Agent Skill authoring rules (kebab-case folder/name, mandatory YAML frontmatter with `name`/`description`, progressive disclosure in the body, no XML tags in the description, etc.) and a strict JSON `responseSchema`. Every model turn returns structured JSON — `skillName`, `folderStructure`, `skillMdContent`, `optionalArtifacts`, `samplePromptText`, `messageToUser` — never free text. The API key is resolved lazily on each chat creation (env var first, `/api/config` as fallback) so key changes take effect without a reload. One model is selectable from the UI (`gemini-3.8-flash`, also the only entry in `ALLOWED_MODELS` in `server.ts`); switching models or logging out resets the chat session ref in `App.tsx`. The generated Python test script in `ArtifactsPanel.tsx` uses the same model.

**Client state (`src/App.tsx`):** All application state lives in this one top-level component — chat messages, the current `SkillArtifacts`, Firebase auth/user state, the list of saved skills, and the active Gemini chat instance (kept in a `ref` so it survives re-renders but is intentionally nulled out to force recreation on model change, logout, or reset). It also owns the AI-Studio-specific API key selection flow (`window.aistudio.hasSelectedApiKey` / `openSelectKey`), which is only present when running inside the AI Studio iframe — outside that environment `hasKey` is assumed true and the server-side `/api/config` fallback takes over.

**Validation (`src/lib/validator.ts`):** After each generation, `validateSkillMd()` re-parses the YAML frontmatter the model produced and checks it against the same rules given to the model (name matches folder name and is kebab-case, description present/short enough/no angle brackets). Warnings are attached to the chat message and surfaced in `ChatPanel`, not treated as hard failures — the user is expected to ask the model to fix them conversationally.

**Persistence (`src/firebase.ts`, `firestore.rules`):** Firebase config is loaded from `firebase-applet-config.json` (checked into the repo — this is an AI-Studio-generated applet config, not a secret `.env` file). Skills are stored in a flat `skills` Firestore collection keyed by `uid`; `folderStructure` and `optionalArtifacts` are stored as JSON strings (see the schema comment at the top of `firestore.rules`). Security rules enforce per-user ownership, field allowlisting, size caps per field, and immutability of `uid`/`createdAt` — when adding new fields to `SkillArtifacts`, update `isValidSkill()` in `firestore.rules` (and `firebase-blueprint.json`'s entity schema) to match, or writes will be rejected.

**Rendering (`src/components/ArtifactsPanel.tsx`):** Takes the flat `folderStructure` array from the model and builds a nested tree (`buildTree`) for display, and independently assembles a downloadable ZIP (via `jszip`) containing `skill.md`, all `optionalArtifacts`, and a generated Python test script that exercises the skill against `google-genai`.

## Key constraints baked into the Gemini system prompt

When touching `geminiService.ts`, preserve these Agent Skill authoring rules the model is instructed to follow (also re-checked client-side by the validator):
- Skill folder name and frontmatter `name` must be kebab-case and identical.
- The main file must be named exactly `SKILL.md`.
- Frontmatter `description` must be under 1024 characters, contain no `<`/`>`, and state both *what* the skill does and *when* to trigger it.
- `SKILL.md` body should use progressive disclosure — keep it focused, push deep detail into `references/`.
