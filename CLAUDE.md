
Default to using Bun instead of Node.js.

- Use `bun <file>` instead of `node <file>` or `ts-node <file>`
- Use `bun test` instead of `jest` or `vitest`
- Use `bun build <file.html|file.ts|file.css>` instead of `webpack` or `esbuild`
- Use `bun install` instead of `npm install` or `yarn install` or `pnpm install`
- Use `bun run <script>` instead of `npm run <script>` or `yarn run <script>` or `pnpm run <script>`
- Use `bunx <package> <command>` instead of `npx <package> <command>`
- Bun automatically loads .env, so don't use dotenv.

## APIs

- `Bun.serve()` supports WebSockets, HTTPS, and routes. Don't use `express`.
- `bun:sqlite` for SQLite. Don't use `better-sqlite3`.
- `Bun.redis` for Redis. Don't use `ioredis`.
- `Bun.sql` for Postgres. Don't use `pg` or `postgres.js`.
- `WebSocket` is built-in. Don't use `ws`.
- Prefer `Bun.file` over `node:fs`'s readFile/writeFile
- Bun.$`ls` instead of execa.

## Testing

Use `bun test` to run tests.

```ts#index.test.ts
import { test, expect } from "bun:test";

test("hello world", () => {
  expect(1).toBe(1);
});
```

## Frontend

Use HTML imports with `Bun.serve()`. Don't use `vite`. HTML imports fully support React, CSS, Tailwind.

Server:

```ts#index.ts
import index from "./index.html"

Bun.serve({
  routes: {
    "/": index,
    "/api/users/:id": {
      GET: (req) => {
        return new Response(JSON.stringify({ id: req.params.id }));
      },
    },
  },
  // optional websocket support
  websocket: {
    open: (ws) => {
      ws.send("Hello, world!");
    },
    message: (ws, message) => {
      ws.send(message);
    },
    close: (ws) => {
      // handle close
    }
  },
  development: {
    hmr: true,
    console: true,
  }
})
```

HTML files can import .tsx, .jsx or .js files directly and Bun's bundler will transpile & bundle automatically. `<link>` tags can point to stylesheets and Bun's CSS bundler will bundle.

```html#index.html
<html>
  <body>
    <h1>Hello, world!</h1>
    <script type="module" src="./frontend.tsx"></script>
  </body>
</html>
```

With the following `frontend.tsx`:

```tsx#frontend.tsx
import React from "react";
import { createRoot } from "react-dom/client";

// import .css files directly and it works
import './index.css';

const root = createRoot(document.body);

export default function Frontend() {
  return <h1>Hello, world!</h1>;
}

root.render(<Frontend />);
```

Then, run index.ts

```sh
bun --hot ./index.ts
```

For more information, read the Bun API docs in `node_modules/bun-types/docs/**.mdx`.

---

# Project: Resume Superset Builder

Deterministic, schema-driven resume generator. One JSON file of resume content +
a small theme preset -> a predictable `.docx` (and `.pdf`) build, every time. Full
rationale and the content/theme JSON contract are documented in `README.md` —
read it before making schema or renderer changes.

## Commands

```sh
bun install                    # deps: docx@9.7.1, typescript, @types/node
bun run build                  # tsc -p tsconfig.json: src/ -> dist/ (commonjs)
bun dist/cli.js --content data/priyanka.resume.json                       # full ground-truth doc
bun dist/cli.js --content data/tailored-golang.example.json --auto-fit-to-single-page
bun dist/cli.js --content <file> --theme slate-compact                   # swap theme only
```

There is no test suite yet (`bun test` has nothing to run). Validate changes by
building and generating both `data/priyanka.resume.json` (multi-page) and
`data/tailored-golang.example.json` (should autofit to 1-2 pages) and inspecting
the resulting DOCX/PDF in `./out`.

PDF + autofit requires **LibreOffice** (`soffice`) and **Poppler** (`pdfinfo`) on
PATH, plus the **Carlito** font installed (Calibri-metric-compatible, keeps page
counts identical across machines).

## Architecture

- `schema/resume.schema.json` — JSON Schema (2020-12) for CONTENT. Superset of
  JSON Resume; nearly every field optional so partial docs still render.
- `schema/theme.schema.json` — JSON Schema for a THEME preset. Strict (rejects
  unknown keys).
- `themes/*.theme.json` — theme presets (`corporate-navy` default, `slate-compact`
  a denser monochrome alternative).
- `data/*.resume.json` — content instances: the full ground-truth superset plus
  tailored/trimmed examples.
- `src/types.ts` — TS interfaces for content + theme.
- `src/validate.ts` — best-effort JSON-Schema validator: collects all issues as
  warnings, applies schema defaults, coerces obvious scalar mismatches; **never
  hard-fails on content** unless `--strict` is passed.
- `src/theme.ts` — resolves a theme preset over built-in defaults.
- `src/render.ts` — docx-js renderer; deterministic, honors theme/order/flags.
- `src/pack.ts` — packs the `.docx`, converts to `.pdf` via LibreOffice, counts
  pages via `pdfinfo`.
- `src/autofit.ts` — single-page autofit loop: shrinks line-height/spacing, then
  margins, then body font (with proportional heading scaling, 14pt name floor),
  stopping at theme-defined floors and warning if a single page isn't reachable.
- `src/cli.ts` — argument parsing and orchestration (validate -> resolve theme ->
  optional autofit -> render -> pack -> convert to PDF).

Data flow: content JSON + theme JSON -> `validate` (both, independently) ->
`resolveTheme` -> (`autofitToSinglePage` if requested, which internally re-renders
and re-packs to measure pages) -> `renderResume` -> `packDocx` -> `convertToPdf`.

## Key invariants (see README "Determinism notes" for full detail)

- Page size pinned to US Letter (12240x15840 DXA); everything else derives from
  the theme.
- Word comments (used for `flagged` highlights) use plain numeric ids
  (`new CommentRangeStart(0)`) to dodge a docx v9 serialization bug; `pack.ts`
  repairs marker ids as a second safety net.
- Compound terms get U+2011 non-breaking hyphens (`ats.nonBreakingHyphens` in the
  theme) so ATS text extraction doesn't drop hyphens at line wraps.
- Content carries zero styling; themes carry only styling
  (`font`, `sizes`, `colors`, `margins`, `spacing`, `ats`, `autofit`). Don't let
  either leak into the other when adding fields.
