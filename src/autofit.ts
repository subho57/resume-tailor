import { ResumeContent, ResolvedTheme } from "./types";
import { renderResume } from "./render";
import { packDocx, convertToPdf, countPdfPages } from "./pack";
import * as path from "path";
import * as os from "os";
import * as fs from "fs";

export interface AutofitResult {
  fitted: boolean;
  pages: number;
  iterations: number;
  finalTheme: ResolvedTheme;
  warnings: string[];
}

const clone = (t: ResolvedTheme): ResolvedTheme => JSON.parse(JSON.stringify(t));

// Render -> pack -> convert -> count pages. Returns page count (-1 if unmeasurable).
async function measure(content: ResumeContent, theme: ResolvedTheme, work: string): Promise<number> {
  const docxPath = path.join(work, "probe.docx");
  const { doc } = renderResume(content, theme);
  await packDocx(doc, docxPath);
  const pdfPath = convertToPdf(docxPath, work);
  return countPdfPages(pdfPath);
}

/**
 * Iteratively adjust the theme to fit a single page.
 * Shrink order (cheapest-to-readability first): spacing/line-height -> margins -> body font.
 * Stops at floors (autofit.minBodySize / autofit.minMargin) and warns if still > 1 page.
 */
export async function autofitToSinglePage(content: ResumeContent, startTheme: ResolvedTheme): Promise<AutofitResult> {
  const warnings: string[] = [];
  let theme = clone(startTheme);
  const af = theme.autofit;
  const work = fs.mkdtempSync(path.join(os.tmpdir(), "autofit-"));

  try {
    let pages = await measure(content, theme, work);
    let iterations = 0;

    if (pages === -1) {
      warnings.push("Could not measure page count (LibreOffice/pdfinfo unavailable); skipped autofit and kept base theme.");
      return { fitted: false, pages, iterations, finalTheme: theme, warnings };
    }

    while (pages > 1 && iterations < af.maxIterations) {
      let changed = false;

      // Phase 1: spacing / line-height.
      if (theme.lineHeight > 1.0) { theme.lineHeight = Math.max(1.0, +(theme.lineHeight - af.spacingStep).toFixed(3)); changed = true; }
      if (theme.sectionBefore > 6) { theme.sectionBefore = Math.max(6, +(theme.sectionBefore - 0.5).toFixed(2)); changed = true; }
      if (theme.sectionAfter > 2.5) { theme.sectionAfter = Math.max(2.5, +(theme.sectionAfter - 0.25).toFixed(2)); changed = true; }
      if (theme.bulletAfter > 1.5) { theme.bulletAfter = Math.max(1.5, +(theme.bulletAfter - 0.25).toFixed(2)); changed = true; }
      pages = await measure(content, theme, work); iterations++;
      if (pages <= 1) break;

      // Phase 2: margins toward floor.
      (["top", "bottom", "left", "right"] as const).forEach((side) => {
        if (theme.margins[side] > af.minMargin) { theme.margins[side] = Math.max(af.minMargin, +(theme.margins[side] - af.marginStep).toFixed(3)); changed = true; }
      });
      pages = await measure(content, theme, work); iterations++;
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
      pages = await measure(content, theme, work); iterations++;

      const atFloors = theme.sizeBody <= af.minBodySize &&
        theme.margins.top <= af.minMargin && theme.margins.bottom <= af.minMargin &&
        theme.margins.left <= af.minMargin && theme.margins.right <= af.minMargin &&
        theme.lineHeight <= 1.0;
      if (!changed || (atFloors && pages > 1)) break;
    }

    const fitted = pages === 1;
    if (!fitted) {
      warnings.push(`Could not fit one page at readable floors (body ${theme.sizeBody}pt, margins ${theme.margins.top}in, line-height ${theme.lineHeight}). Result is ${pages} page(s). Consider trimming content rather than shrinking further.`);
    }
    return { fitted, pages, iterations, finalTheme: theme, warnings };
  } finally {
    fs.rmSync(work, { recursive: true, force: true });
  }
}
