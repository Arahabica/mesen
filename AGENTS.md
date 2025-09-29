# Repository Guidelines

## Project Structure & Module Organization
- `app/` hosts the Next.js App Router entrypoints (`layout.tsx`, `page.tsx`) and global styles.
- Reusable UI lives in `components/`; pair related hooks in `hooks/` and pure helpers in `utils/`.
- Configuration lives at the root (`tailwind.config.ts`, `tsconfig.json`, `next.config.js`), and static assets belong in `public/`.
- Constants and shared types sit in `constants/` and `types/`; update these instead of scattering magic numbers.

## Build, Test, and Development Commands
- `npm install` — install dependencies; rerun after pulling lockfile changes.
- `npm run dev` — launch the local dev server at http://localhost:3000 for interactive testing.
- `npm run build` — create the production bundle; verify before tagging releases or deploying.
- `npm run start` — serve the production build locally (uses the output from `npm run build`).
- `npm run lint` — run the Next.js ESLint preset; treat warnings as actionable.
- `npm run deploy` — build and push to Vercel Production; ensure the build passes locally first.

## Coding Style & Naming Conventions
- TypeScript with strict typing; avoid `any` and prefer explicit interfaces in `types/`.
- React components are PascalCase (`CanvasEditor.tsx`), hooks are camelCase (`useTouch.ts`).
- Use functional components and keep side effects inside hooks; colocate component styles (e.g., `LandingImage.css`).
- TailwindCSS is available; prefer utility classes over inline styles when possible.
- Format with the default Next.js ESLint + Prettier integration (`npm run lint -- --fix` when needed).

## Testing Guidelines
- No automated test suite exists yet; when adding behavior, include targeted tests colocated as `<Component>.test.tsx` using Jest + React Testing Library (add dependencies if missing) or document manual QA steps in the PR.
- Exercise critical flows manually: upload an image, draw lines, undo/redo, download, and mobile pinch/zoom (Chrome DevTools device emulation works).
- Record regressions with reproducible steps and consider adding Playwright smoke tests under `tests/` for UI flows.

## Commit & Pull Request Guidelines
- Follow the existing short, present-tense commit style (often Japanese summaries like `OGP修正`); keep scope focused per commit.
- Reference issues when available (`fix: ... (#123)`), and include context for user-facing changes.
- PRs should describe motivation, implementation notes, screenshots or screen recordings for UI updates, and manual test evidence (commands run or browsers checked).
- Request review before merging; avoid force-pushes after review without summarizing changes.
