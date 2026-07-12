import { Theme, ResolvedTheme } from "./types";

// Canonical defaults (kept in sync with schema/theme.schema.json).
const D = {
  fontFamily: "Carlito",
  baseSize: 10.5,
  sizeName: 20,
  sizeSectionHeading: 11,
  sizeSmall: 9,
  accent: "2E74B5",
  body: "1A1A1A",
  rule: "9B9B9B",
  link: "0563C1",
  margins: { top: 0.6, right: 0.6, bottom: 0.6, left: 0.6 },
  sectionBefore: 11,
  sectionAfter: 4.5,
  bulletAfter: 3,
  lineHeight: 1.15,
  leftCellPct: 0.61,
  nonBreakingHyphens: true,
  autofit: { minBodySize: 9.5, minMargin: 0.4, fontStep: 0.5, marginStep: 0.05, spacingStep: 0.1, maxIterations: 40 },
};

const num = (v: unknown, fallback: number): number => (typeof v === "number" && !Number.isNaN(v) ? v : fallback);

export function resolveTheme(t: Theme | undefined): ResolvedTheme {
  t = t || {};
  const baseSize = num(t.font?.baseSize, D.baseSize);
  const sizes = t.sizes || {};
  const colors = t.colors || {};
  const margins = t.margins || {};
  const spacing = t.spacing || {};
  const header = t.header || {};
  const ats = t.ats || {};
  const af = t.autofit || {};

  return {
    name: t.name || "custom",
    fontFamily: t.font?.family || D.fontFamily,
    baseSize,
    sizeName: num(sizes.name as number, D.sizeName),
    sizeSectionHeading: num(sizes.sectionHeading as number, D.sizeSectionHeading),
    sizeBody: num(sizes.body as number, baseSize),
    sizeSmall: num(sizes.small as number, D.sizeSmall),
    accent: colors.accent || D.accent,
    body: colors.body || D.body,
    rule: colors.rule || D.rule,
    link: colors.link || D.link,
    margins: {
      top: num(margins.top, D.margins.top),
      right: num(margins.right, D.margins.right),
      bottom: num(margins.bottom, D.margins.bottom),
      left: num(margins.left, D.margins.left),
    },
    sectionBefore: num(spacing.sectionBefore, D.sectionBefore),
    sectionAfter: num(spacing.sectionAfter, D.sectionAfter),
    bulletAfter: num(spacing.bulletAfter, D.bulletAfter),
    lineHeight: num(spacing.lineHeight, D.lineHeight),
    leftCellPct: num(header.leftCellPct, D.leftCellPct),
    nonBreakingHyphens: ats.nonBreakingHyphens !== undefined ? !!ats.nonBreakingHyphens : D.nonBreakingHyphens,
    autofit: {
      minBodySize: num(af.minBodySize, D.autofit.minBodySize),
      minMargin: num(af.minMargin, D.autofit.minMargin),
      fontStep: num(af.fontStep, D.autofit.fontStep),
      marginStep: num(af.marginStep, D.autofit.marginStep),
      spacingStep: num(af.spacingStep, D.autofit.spacingStep),
      maxIterations: num(af.maxIterations, D.autofit.maxIterations),
    },
  };
}
