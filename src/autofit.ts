import { ResumeContent, ResolvedTheme } from "./types";
import { renderResume } from "./render";
import { packDocx, convertToPdf, countPdfPages, checkPdfToolchain } from "./pack";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

export interface AutofitResult {
  fitted: boolean;
  pages: number;
  iterations: number;
  finalTheme: ResolvedTheme;
  warnings: string[];
}

const clone = (t: ResolvedTheme): ResolvedTheme => JSON.parse(JSON.stringify(t));

// Render -> pack -> convert -> count pages. Returns page count (-1 if unmeasurable).
//
// Each call gets its own freshly created temp directory (not just a unique filename
// within one shared directory) — observed in practice, rapid repeated soffice/pdfinfo
// invocations against a churning shared directory produce stably-wrong (not flaky)
// page counts, consistent with the OS/tooling confusing a freshly written file with a
// just-deleted one at the same path or a recently-reused inode. A brand new directory
// per call is the strongest structural isolation available against that class of bug.
async function measure(content: ResumeContent, theme: ResolvedTheme, workRoot: string, keywords: string[]): Promise<number> {
  const work = mkdtempSync(join(workRoot, "m-"));
  try {
    const docxPath = join(work, "probe.docx");
    const { doc } = renderResume(content, theme, keywords);
    await packDocx(doc, docxPath);
    const pdfPath = await convertToPdf(docxPath, work);
    const pages = await countPdfPages(pdfPath);
    if (process.env.DEBUG_AUTOFIT) console.error(`[DEBUG] measure: pdfPath=${pdfPath} exists=${await Bun.file(pdfPath).exists()} pages=${pages} lineHeight=${theme.lineHeight} margins=${theme.margins.top} sizeBody=${theme.sizeBody}`);
    return pages;
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

/**
 * Iteratively adjust the theme to fit a single page.
 * Shrink order (cheapest-to-readability first): spacing/line-height -> margins -> body font.
 * Stops at floors (autofit.minBodySize / autofit.minMargin) and warns if still > 1 page.
 */
export async function autofitToSinglePage(content: ResumeContent, startTheme: ResolvedTheme, keywords: string[] = []): Promise<AutofitResult> {
  const warnings: string[] = [];
  let theme = clone(startTheme);
  const af = theme.autofit;
  const work = mkdtempSync(join(tmpdir(), "autofit-"));

  let iterations = 0;
  // -1 means "unmeasurable this attempt" (e.g. a transient conversion hiccup), never
  // "fits" — retrying once before giving up avoids conflating the two, which would
  // otherwise let the loop stop early believing a false "fit to 1 page".
  const measureReliably = async (): Promise<number> => {
    let p = await measure(content, theme, work, keywords);
    iterations++;
    if (p === -1) { p = await measure(content, theme, work, keywords); iterations++; }
    return p;
  };

  try {
    let pages = await measureReliably();
    let giveUp = false;

    if (pages === -1) {
      const toolchain = checkPdfToolchain();
      const missing: string[] = [];
      if (!toolchain.soffice) missing.push("soffice (LibreOffice)");
      if (!toolchain.pdfinfo) missing.push("pdfinfo (Poppler)");
      const detail = missing.length ? `missing: ${missing.join(", ")}` : "conversion failed twice in a row despite both being on PATH";
      warnings.push(`Could not measure page count (${detail}); skipped autofit and kept base theme. See README.md Prerequisites.`);
      return { fitted: false, pages, iterations, finalTheme: theme, warnings };
    }

    while (pages > 1 && iterations < af.maxIterations) {
      let changed = false;

      // Phase 1: spacing / line-height.
      if (theme.lineHeight > 1.0) { theme.lineHeight = Math.max(1.0, +(theme.lineHeight - af.spacingStep).toFixed(3)); changed = true; }
      if (theme.sectionBefore > 6) { theme.sectionBefore = Math.max(6, +(theme.sectionBefore - 0.5).toFixed(2)); changed = true; }
      if (theme.sectionAfter > 2.5) { theme.sectionAfter = Math.max(2.5, +(theme.sectionAfter - 0.25).toFixed(2)); changed = true; }
      if (theme.bulletAfter > 1.5) { theme.bulletAfter = Math.max(1.5, +(theme.bulletAfter - 0.25).toFixed(2)); changed = true; }
      pages = await measureReliably();
      if (pages === -1) { giveUp = true; break; }
      if (pages <= 1) break;

      // Phase 2: margins toward floor.
      (["top", "bottom", "left", "right"] as const).forEach((side) => {
        if (theme.margins[side] > af.minMargin) { theme.margins[side] = Math.max(af.minMargin, +(theme.margins[side] - af.marginStep).toFixed(3)); changed = true; }
      });
      pages = await measureReliably();
      if (pages === -1) { giveUp = true; break; }
      if (pages <= 1) break;

      // Phase 3: body font (proportional derived sizes) toward floor.
      if (theme.sizeBody > af.minBodySize) {
        const newBody = Math.max(af.minBodySize, +(theme.sizeBody - af.fontStep).toFixed(2));
        const ratio = newBody / theme.sizeBody;
        theme.sizeBody = newBody;
        theme.baseSize = +(theme.baseSize * ratio).toFixed(2);
        theme.sizeSmall = Math.max(8, +(theme.sizeSmall * ratio).toFixed(2));
        theme.sizeSectionHeading = Math.max(10, +(theme.sizeSectionHeading * ratio).toFixed(2));
        theme.sizeName = Math.max(14, +(theme.sizeName * ratio).toFixed(2)); // name floor 14pt
        changed = true;
      }
      pages = await measureReliably();
      if (pages === -1) { giveUp = true; break; }

      const atFloors = theme.sizeBody <= af.minBodySize &&
        theme.margins.top <= af.minMargin && theme.margins.bottom <= af.minMargin &&
        theme.margins.left <= af.minMargin && theme.margins.right <= af.minMargin &&
        theme.lineHeight <= 1.0;
      if (!changed || (atFloors && pages > 1)) break;
    }

    if (giveUp) {
      warnings.push("Page-count measurement failed twice in a row mid-autofit (LibreOffice/pdfinfo hiccup); stopped shrinking with the last verified theme rather than guessing.");
    }
    const fitted = !giveUp && pages === 1;
    if (!fitted && !giveUp) {
      warnings.push(`Could not fit one page at readable floors (body ${theme.sizeBody}pt, margins ${theme.margins.top}in, line-height ${theme.lineHeight}). Result is ${pages} page(s). Consider trimming content rather than shrinking further.`);
    }
    return { fitted, pages, iterations, finalTheme: theme, warnings };
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}
