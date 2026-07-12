#!/usr/bin/env node
// ============================================================================
// Resume builder CLI.
//
// Usage:
//   resume-build --content <file.json> [options]
//
// Options:
//   --content <path>            Resume content JSON (required).
//   --theme <path|name>         Theme preset: a .json path, or a name resolved to
//                               themes/<name>.theme.json. Overrides content.theme.
//   --out <dir>                 Output directory (default: ./out).
//   --basename <name>           Output file base name (default: derived from name).
//   --auto-fit-to-single-page   Iteratively shrink spacing/margins/font (within
//                               ATS-safe floors) to fit one page; warns if it can't.
//   --no-pdf                    Skip PDF generation (docx only).
//   --schema <path>             Content schema (default: schema/resume.schema.json).
//   --theme-schema <path>       Theme schema (default: schema/theme.schema.json).
//   --strict                    Exit non-zero if any validation warnings occur.
//   --quiet                     Suppress warning output.
//
// Behavior: validation is BEST-EFFORT — warnings are printed, defaults applied,
// obvious type mismatches coerced, and the resume is rendered from whatever
// content is present. It never hard-fails on content problems (unless --strict).
// ============================================================================

import * as fs from "fs";
import * as path from "path";
import { ResumeContent, Theme } from "./types";
import { validate, Warning } from "./validate";
import { resolveTheme } from "./theme";
import { renderResume } from "./render";
import { packDocx, convertToPdf, countPdfPages } from "./pack";
import { autofitToSinglePage } from "./autofit";

interface Args {
  content?: string; theme?: string; out: string; basename?: string;
  autofit: boolean; pdf: boolean; schema: string; themeSchema: string;
  strict: boolean; quiet: boolean;
}

function parseArgs(argv: string[]): Args {
  const here = __dirname;
  const root = path.resolve(here, "..");
  const a: Args = {
    out: path.resolve(process.cwd(), "out"),
    autofit: false, pdf: true,
    schema: path.join(root, "schema", "resume.schema.json"),
    themeSchema: path.join(root, "schema", "theme.schema.json"),
    strict: false, quiet: false,
  };
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    const next = () => argv[++i];
    switch (arg) {
      case "--content": a.content = next(); break;
      case "--theme": a.theme = next(); break;
      case "--out": a.out = path.resolve(next()); break;
      case "--basename": a.basename = next(); break;
      case "--auto-fit-to-single-page": a.autofit = true; break;
      case "--no-pdf": a.pdf = false; break;
      case "--schema": a.schema = next(); break;
      case "--theme-schema": a.themeSchema = next(); break;
      case "--strict": a.strict = true; break;
      case "--quiet": a.quiet = true; break;
      case "-h": case "--help": printHelp(); process.exit(0);
      default: console.error(`Unknown option: ${arg}`); printHelp(); process.exit(2);
    }
  }
  return a;
}

function printHelp() {
  console.log(`resume-build --content <file.json> [--theme <name|path>] [--out <dir>]
                   [--basename <name>] [--auto-fit-to-single-page] [--no-pdf]
                   [--strict] [--quiet]`);
}

function readJson(p: string): any {
  return JSON.parse(fs.readFileSync(p, "utf-8"));
}

function resolveThemePath(themeArg: string | undefined, contentTheme: string | undefined, root: string): string | undefined {
  const name = themeArg || contentTheme;
  if (!name) return undefined;
  if (name.endsWith(".json") && fs.existsSync(name)) return name;
  const byName = path.join(root, "themes", `${name}.theme.json`);
  if (fs.existsSync(byName)) return byName;
  if (fs.existsSync(name)) return name;
  return undefined;
}

function printWarnings(label: string, warnings: Warning[] | string[], quiet: boolean) {
  if (quiet || !warnings.length) return;
  console.warn(`\n⚠  ${label} (${warnings.length}):`);
  for (const w of warnings as any[]) {
    if (typeof w === "string") console.warn(`   - ${w}`);
    else console.warn(`   - ${w.path}: ${w.message}`);
  }
}

async function main() {
  const args = parseArgs(process.argv);
  const root = path.resolve(__dirname, "..");

  if (!args.content) { console.error("Error: --content <file.json> is required."); printHelp(); process.exit(2); }
  if (!fs.existsSync(args.content)) { console.error(`Error: content file not found: ${args.content}`); process.exit(2); }

  // --- load + validate content (best-effort) ---
  const content: ResumeContent = readJson(args.content);
  const contentSchema = fs.existsSync(args.schema) ? readJson(args.schema) : null;
  let contentWarnings: Warning[] = [];
  if (contentSchema) contentWarnings = validate(contentSchema, content);
  printWarnings("Content validation warnings", contentWarnings, args.quiet);

  // --- load + validate theme (best-effort) ---
  const themePath = resolveThemePath(args.theme, content.theme, root);
  let themeRaw: Theme = {};
  if (themePath) {
    themeRaw = readJson(themePath);
    const themeSchema = fs.existsSync(args.themeSchema) ? readJson(args.themeSchema) : null;
    if (themeSchema) {
      const themeWarnings = validate(themeSchema, themeRaw);
      printWarnings(`Theme validation warnings (${path.basename(themePath)})`, themeWarnings, args.quiet);
      contentWarnings = contentWarnings.concat(themeWarnings);
    }
  } else if (args.theme || content.theme) {
    console.warn(`⚠  Theme "${args.theme || content.theme}" not found; using built-in defaults.`);
  }
  const theme = resolveTheme(themeRaw);

  // --- output paths ---
  fs.mkdirSync(args.out, { recursive: true });
  const base = args.basename || sanitize(content.basics?.name || "resume");
  const docxPath = path.join(args.out, `${base}.docx`);
  const runtimeWarnings: string[] = [];

  // --- autofit (optional) ---
  let finalTheme = theme;
  if (args.autofit) {
    if (!args.pdf) {
      runtimeWarnings.push("--auto-fit-to-single-page requires PDF rendering to measure pages; ignoring --no-pdf for measurement.");
    }
    const result = await autofitToSinglePage(content, theme);
    finalTheme = result.finalTheme;
    runtimeWarnings.push(...result.warnings);
    if (!args.quiet) {
      console.log(`\n▸ Autofit: ${result.fitted ? "fit to 1 page" : `stopped at ${result.pages} page(s)`} after ${result.iterations} iteration(s).`);
      console.log(`  final: body ${finalTheme.sizeBody}pt · margins ${finalTheme.margins.top}in · line-height ${finalTheme.lineHeight}`);
    }
  }

  // --- render + pack final docx ---
  const { doc, commentCount } = renderResume(content, finalTheme);
  const { commentIdsFixed } = await packDocx(doc, docxPath);
  if (!args.quiet) {
    console.log(`\n✓ DOCX: ${docxPath}`);
    if (commentCount) console.log(`  ${commentCount} flag comment(s)${commentIdsFixed ? `; repaired ${commentIdsFixed} marker id(s)` : ""}.`);
  }

  // --- pdf ---
  if (args.pdf) {
    const pdfPath = convertToPdf(docxPath, args.out);
    const pages = countPdfPages(pdfPath);
    if (fs.existsSync(pdfPath)) {
      if (!args.quiet) console.log(`✓ PDF:  ${pdfPath}${pages > 0 ? `  (${pages} page${pages === 1 ? "" : "s"})` : ""}`);
    } else {
      runtimeWarnings.push("PDF conversion failed (LibreOffice unavailable?). DOCX was still written.");
    }
  }

  printWarnings("Runtime warnings", runtimeWarnings, args.quiet);

  const totalWarnings = contentWarnings.length + runtimeWarnings.length;
  if (args.strict && totalWarnings > 0) {
    console.error(`\n✗ --strict: ${totalWarnings} warning(s); exiting non-zero.`);
    process.exit(1);
  }
}

function sanitize(s: string): string {
  return s.replace(/[^\w.-]+/g, "_").replace(/^_+|_+$/g, "") || "resume";
}

main().catch((e) => { console.error("Fatal:", e); process.exit(1); });
