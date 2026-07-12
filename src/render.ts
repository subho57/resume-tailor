import {
  Document, Paragraph, TextRun, ExternalHyperlink,
  Table, TableRow, TableCell, WidthType, BorderStyle, AlignmentType,
  TabStopType,
  VerticalAlign, LevelFormat,
  CommentRangeStart, CommentRangeEnd, CommentReference,
} from "docx";
import {
  ResumeContent, ResolvedTheme, SectionName, Highlight, Work, Education, Role,
} from "./types";

const NBH = "\u2011"; // non-breaking hyphen
const EN = "\u2013";  // en dash

const US_LETTER = { width: 12240, height: 15840 };
const DXA_PER_INCH = 1440;
const inchToDxa = (v: number) => Math.round(v * DXA_PER_INCH);
const ptToHalf = (pt: number) => Math.round(pt * 2);   // docx size unit = half-points
const ptToTwip = (pt: number) => Math.round(pt * 20);  // spacing unit = twentieths of a point

// Defensive coercions so malformed/partial content never throws (best-effort render).
const asArray = <T,>(v: any): T[] => (Array.isArray(v) ? v : []);
const asStr = (v: any): string => (typeof v === "string" ? v : v == null ? "" : String(v));

// Section titles as displayed (ALL CAPS applied at render).
const SECTION_TITLES: Record<SectionName, string> = {
  about: "About This Document",
  preferences: "Job Search Preferences",
  summary: "Summary",
  skills: "Technical Skills",
  work: "Work Experience",
  education: "Education",
  openSource: "Open-Source Contributions",
  projects: "Projects",
  certifications: "Certifications",
  languages: "Languages",
  recommendations: "Recommendations",
  companyContext: "Company Context (Appendix)",
};

const CANONICAL_ORDER: SectionName[] = [
  "about", "preferences", "summary", "skills", "work", "education",
  "openSource", "projects", "certifications", "languages", "recommendations", "companyContext",
];

// Apply non-breaking hyphens to compound terms (ATS line-wrap protection).
// Only used when theme.nonBreakingHyphens is true. We convert hyphens that sit
// between word characters (compound words), leaving number ranges/en-dashes alone.
function ats(s: string, on: boolean): string {
  if (!s || !on) return s || "";
  return s.replace(/(?<=\w)-(?=\w)/g, NBH);
}

export interface RenderResult {
  doc: Document;
  commentCount: number;
}

export function renderResume(content: ResumeContent, theme: ResolvedTheme): RenderResult {
  const NONE = { style: BorderStyle.NONE, size: 0, color: "auto" } as const;
  const usableWidth = US_LETTER.width - inchToDxa(theme.margins.left) - inchToDxa(theme.margins.right);

  // Defensive normalization: guarantee list-typed fields are arrays and scalar
  // notes are strings, so malformed/partial LLM output degrades gracefully
  // rather than throwing. Validation has already warned about any mismatches.
  content = { ...content };
  content.work = asArray(content.work);
  content.education = asArray(content.education);
  content.skills = asArray(content.skills);
  content.projects = asArray(content.projects);
  content.certifications = asArray(content.certifications);
  content.languages = asArray(content.languages);
  content.recommendations = asArray(content.recommendations);
  content.companyContext = asArray(content.companyContext);
  if (content.basics) {
    content.basics = { ...content.basics };
    if (content.basics.profiles && !Array.isArray(content.basics.profiles)) content.basics.profiles = [];
    if (content.basics.summaries && typeof content.basics.summaries !== "object") content.basics.summaries = {};
  }
  if (content.openSource && typeof content.openSource === "object") {
    content.openSource = { ...content.openSource, items: asArray(content.openSource.items) };
  }
  if (content.preferences && typeof content.preferences === "object") {
    content.preferences = {
      ...content.preferences,
      locations: asArray(content.preferences.locations),
      roles: asArray(content.preferences.roles),
    };
  }

  // ---- comment registry (plain-number ids -> avoids the v9 [object Object] bug) ----
  const commentsChildren: any[] = [];
  let nextCommentId = 0;
  const addComment = (text: string): number => {
    const id = nextCommentId++;
    commentsChildren.push({
      id, author: "Ground Truth", date: new Date(),
      children: [new Paragraph({ children: [new TextRun({ text, font: theme.fontFamily, size: ptToHalf(theme.sizeSmall) })] })],
    });
    return id;
  };

  // ---- run/paragraph helpers ----
  const run = (text: string, o: { bold?: boolean; italics?: boolean; color?: string; size?: number } = {}) =>
    new TextRun({ text, font: theme.fontFamily, color: o.color || theme.body, bold: !!o.bold, italics: !!o.italics, size: ptToHalf(o.size ?? theme.sizeBody) });

  const link = (label: string, url: string, size?: number) =>
    new ExternalHyperlink({ link: url, children: [new TextRun({ text: label, font: theme.fontFamily, color: theme.link, size: ptToHalf(size ?? theme.sizeBody), underline: {} })] });

  const lineRule = (multiple: number) => ({ line: Math.round(240 * multiple), lineRule: "auto" as const });

  const sectionHeading = (title: string) => new Paragraph({
    spacing: { before: ptToTwip(theme.sectionBefore), after: ptToTwip(theme.sectionAfter) },
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: theme.rule, space: 2 } },
    children: [new TextRun({ text: title.toUpperCase(), font: theme.fontFamily, bold: true, color: theme.accent, size: ptToHalf(theme.sizeSectionHeading) })],
  });

  const bullet = (children: any[]) => new Paragraph({
    numbering: { reference: "bullets", level: 0 },
    spacing: { after: ptToTwip(theme.bulletAfter), ...lineRule(theme.lineHeight) },
    children,
  });

  // A "left .......... right-aligned" line. Uses an explicit RIGHT tab stop at the
  // usable-width position plus a literal tab, which renders correctly in BOTH Word
  // and LibreOffice. (docx PositionalTab is not honored by LibreOffice, so the date
  // would otherwise sit mid-line in the PDF.)
  const leftRight = (leftRuns: any[], rightText: string) => new Paragraph({
    spacing: { after: ptToTwip(1) },
    tabStops: [{ type: TabStopType.RIGHT, position: usableWidth }],
    children: [
      ...leftRuns,
      new TextRun({ text: "\t" + rightText, font: theme.fontFamily, color: theme.body, italics: true, size: ptToHalf(theme.sizeBody) }),
    ],
  });

  // Wrap a set of runs in a comment (flagged content).
  const commentedParagraph = (runs: any[], commentText: string, opts: { bullet?: boolean } = {}) => {
    const id = addComment(commentText);
    const kids = [new CommentRangeStart(id), ...runs, new CommentRangeEnd(id), new TextRun({ children: [new CommentReference(id)] })];
    if (opts.bullet) {
      return new Paragraph({ numbering: { reference: "bullets", level: 0 }, spacing: { after: ptToTwip(theme.bulletAfter), ...lineRule(theme.lineHeight) }, children: kids });
    }
    return new Paragraph({ spacing: { after: ptToTwip(1) }, children: kids });
  };

  const children: any[] = [];

  // ================= HEADER (two-column table, zeroed margins) =================
  const b = content.basics || {};
  if (b.name || (b.profiles && b.profiles.length) || b.email || b.phone) {
    const leftW = Math.round(usableWidth * theme.leftCellPct);
    const rightW = usableWidth - leftW;
    const zero = { top: 0, bottom: 0, left: 0, right: 0 };

    const leftChildren: any[] = [];
    if (b.name) leftChildren.push(new Paragraph({ spacing: { after: ptToTwip(1) }, children: [new TextRun({ text: b.name, font: theme.fontFamily, bold: true, color: theme.accent, size: ptToHalf(theme.sizeName) })] }));
    if (b.label) leftChildren.push(new Paragraph({ spacing: { after: ptToTwip(1) }, children: [run(ats(b.label, theme.nonBreakingHyphens), { italics: true })] }));
    const loc = b.location?.display || [b.location?.city, b.location?.region, b.location?.countryCode].filter(Boolean).join(", ");
    if (loc) leftChildren.push(new Paragraph({ children: [run(loc, { size: theme.sizeSmall })] }));
    if (!leftChildren.length) leftChildren.push(new Paragraph({ children: [run("")] }));

    const rightChildren: any[] = [];
    const rline = (kids: any[]) => new Paragraph({ alignment: AlignmentType.RIGHT, spacing: { after: ptToTwip(0.5) }, children: kids });
    if (b.phone) rightChildren.push(rline([link(b.phone, "tel:" + b.phone.replace(/\s+/g, ""), theme.sizeSmall)]));
    if (b.email) rightChildren.push(rline([link(b.email, "mailto:" + b.email, theme.sizeSmall)]));
    (b.profiles || []).forEach((p) => {
      if (!p.url && !p.display) return;
      rightChildren.push(rline([link(p.display || (p.url || "").replace(/^https?:\/\//, ""), p.url || "#", theme.sizeSmall)]));
    });
    if (!rightChildren.length) rightChildren.push(new Paragraph({ children: [run("")] }));

    children.push(new Table({
      width: { size: usableWidth, type: WidthType.DXA },
      columnWidths: [leftW, rightW],
      borders: { top: NONE, bottom: NONE, left: NONE, right: NONE, insideHorizontal: NONE, insideVertical: NONE },
      rows: [new TableRow({ children: [
        new TableCell({ width: { size: leftW, type: WidthType.DXA }, margins: zero, borders: { top: NONE, bottom: NONE, left: NONE, right: NONE }, verticalAlign: VerticalAlign.TOP, children: leftChildren }),
        new TableCell({ width: { size: rightW, type: WidthType.DXA }, margins: zero, borders: { top: NONE, bottom: NONE, left: NONE, right: NONE }, verticalAlign: VerticalAlign.TOP, children: rightChildren }),
      ] })],
    }));
  }

  // ================= section renderers =================
  const renderers: Record<SectionName, () => void> = {
    about: () => {
      if (!content.about) return;
      children.push(sectionHeading(SECTION_TITLES.about));
      children.push(new Paragraph({ spacing: { after: ptToTwip(3), ...lineRule(theme.lineHeight) }, children: [run(content.about)] }));
    },
    preferences: () => {
      const p = content.preferences;
      if (!p || (!(p.locations && p.locations.length) && !(p.roles && p.roles.length) && !p.hybrid)) return;
      children.push(sectionHeading(SECTION_TITLES.preferences));
      if (p.locations && p.locations.length) children.push(new Paragraph({ spacing: { after: ptToTwip(1) }, children: [run("Preferred locations (priority order): ", { bold: true }), run(p.locations.join("  >  "))] }));
      if (p.hybrid) children.push(new Paragraph({ spacing: { after: ptToTwip(1) }, children: [run(p.hybrid, { italics: true })] }));
      if (p.roles && p.roles.length) children.push(new Paragraph({ spacing: { after: ptToTwip(1) }, children: [run("Target roles (priority order): ", { bold: true }), run(p.roles.join("  >  "))] }));
    },
    summary: () => {
      const bb = content.basics || {};
      const summaries = bb.summaries || {};
      const active = bb.activeSummary && summaries[bb.activeSummary];
      const single = active || summaries.default || bb.summary;
      if (!single && Object.keys(summaries).length === 0) return;
      children.push(sectionHeading(SECTION_TITLES.summary));
      if (bb.activeSummary && summaries[bb.activeSummary]) {
        // tailored render: one summary
        children.push(new Paragraph({ spacing: { after: ptToTwip(3), ...lineRule(theme.lineHeight) }, children: [run(ats(summaries[bb.activeSummary], theme.nonBreakingHyphens))] }));
      } else if (Object.keys(summaries).length > 0) {
        // ground-truth: list ALL variants, labeled
        for (const [key, text] of Object.entries(summaries)) {
          const label = key === "default" ? "Default" : key.replace(/-/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
          children.push(new Paragraph({ spacing: { after: ptToTwip(3), ...lineRule(theme.lineHeight) }, children: [run(label + ": ", { bold: true, color: theme.accent }), run(ats(text, theme.nonBreakingHyphens))] }));
        }
      } else if (single) {
        children.push(new Paragraph({ spacing: { after: ptToTwip(3), ...lineRule(theme.lineHeight) }, children: [run(ats(single, theme.nonBreakingHyphens))] }));
      }
    },
    skills: () => {
      const sk = content.skills || [];
      if (!sk.length) return;
      children.push(sectionHeading(SECTION_TITLES.skills));
      sk.forEach((g) => {
        const items = g.keywordsText || asArray(g.keywords).join(", ");
        if (!g.name && !items) return;
        children.push(new Paragraph({ spacing: { after: ptToTwip(2.5), ...lineRule(theme.lineHeight) }, children: [
          ...(g.name ? [run(g.name + ": ", { bold: true })] : []),
          run(ats(items, theme.nonBreakingHyphens)),
        ] }));
      });
    },
    work: () => {
      const w = content.work || [];
      if (!w.length) return;
      children.push(sectionHeading(SECTION_TITLES.work));
      w.forEach((job: Work) => {
        const dateRight = job.dateDisplay || composeDates(job.startDate, job.endDate);
        const compRuns = [
          new TextRun({ text: job.name || "", font: theme.fontFamily, bold: true, color: theme.accent, size: ptToHalf(theme.sizeSectionHeading) }),
          ...(job.location ? [new TextRun({ text: "   " + job.location, font: theme.fontFamily, color: theme.body, size: ptToHalf(theme.sizeSmall) })] : []),
        ];
        children.push(leftRight(compRuns, dateRight || ""));
        if (job.domainNote) children.push(new Paragraph({ spacing: { after: ptToTwip(2), ...lineRule(theme.lineHeight) }, children: [run(ats(job.domainNote, theme.nonBreakingHyphens), { italics: true, size: theme.sizeSmall })] }));
        const allRoles: Role[] = asArray<Role>(job.roles).length ? asArray<Role>(job.roles) : (job.position ? [{ position: job.position, dateDisplay: "" }] : []);
        // roleDisplay controls how multiple roles at one company are shown:
        //   "separate"    (default) -> one line per role, each with its own dates
        //   "senior-only"           -> only the most-senior title (first in the list),
        //                              spanning the company's full date range
        //   "combined"              -> titles joined on one line, company's full span
        const roleDisplay = job.roleDisplay || "separate";
        let roles: Role[] = allRoles;
        if (allRoles.length > 1 && roleDisplay === "senior-only") {
          roles = [{ position: allRoles[0].position, dateDisplay: dateRight || allRoles[0].dateDisplay || "" }];
        } else if (allRoles.length > 1 && roleDisplay === "combined") {
          const titles = allRoles.map((r) => r.position).filter(Boolean).join(" / ");
          roles = [{ position: titles, dateDisplay: dateRight || "" }];
        }
        roles.forEach((r) => {
          const rd = r.dateDisplay || composeDates(r.startDate, r.endDate);
          children.push(leftRight([new TextRun({ text: r.position || "", font: theme.fontFamily, italics: true, bold: true, color: theme.body, size: ptToHalf(theme.sizeBody) })], rd || ""));
        });
        asArray<Highlight>(job.highlights).forEach((h: Highlight) => {
          if (typeof h === "string") { children.push(bullet([run(ats(h, theme.nonBreakingHyphens))])); return; }
          const text = ats(h.text || "", theme.nonBreakingHyphens);
          if (h.flagged && h.note) children.push(commentedParagraph([run(text)], h.note, { bullet: true }));
          else children.push(bullet([run(text)]));
        });
      });
    },
    education: () => {
      const ed = content.education || [];
      if (!ed.length) return;
      children.push(sectionHeading(SECTION_TITLES.education));
      ed.forEach((e: Education) => {
        const dateRight = e.dateDisplay || composeDates(e.startDate, e.endDate);
        const schoolRuns = [
          new TextRun({ text: e.institution || "", font: theme.fontFamily, bold: true, color: theme.accent, size: ptToHalf(theme.sizeSectionHeading) }),
          ...(e.location ? [new TextRun({ text: "   " + e.location, font: theme.fontFamily, color: theme.body, size: ptToHalf(theme.sizeSmall) })] : []),
        ];
        children.push(leftRight(schoolRuns, dateRight || ""));
        const degree = e.degreeDisplay || [e.studyType, e.area].filter(Boolean).join(", ");
        if (degree) children.push(new Paragraph({ spacing: { after: ptToTwip(1) }, children: [run(degree, { italics: true })] }));
        if (e.score) {
          if (e.scoreFlagged && e.scoreNote) children.push(commentedParagraph([run(e.score)], e.scoreNote));
          else children.push(new Paragraph({ spacing: { after: ptToTwip(1) }, children: [run(e.score)] }));
        }
        const detailBits = [e.detail, asArray(e.courses).length ? ("Relevant Coursework: " + asArray(e.courses).join(", ")) : ""].filter(Boolean).join(" ");
        if (detailBits) children.push(new Paragraph({ spacing: { after: ptToTwip(2) }, children: [run(ats(detailBits, theme.nonBreakingHyphens), { size: theme.sizeSmall })] }));
      });
    },
    openSource: () => {
      const os = content.openSource;
      if (!os || (!os.headline && !(os.items && os.items.length))) return;
      children.push(sectionHeading(SECTION_TITLES.openSource));
      if (os.headline) children.push(new Paragraph({ spacing: { after: ptToTwip(2.5), ...lineRule(theme.lineHeight) }, children: [run(ats(os.headline, theme.nonBreakingHyphens))] }));
      if (os.note) {
        if (os.noteFlagged) children.push(commentedParagraph([run(ats(os.note, theme.nonBreakingHyphens), { italics: true, size: theme.sizeSmall })], "Provenance note: distinguishes independently verified PRs from self-reported aggregate figures."));
        else children.push(new Paragraph({ spacing: { after: ptToTwip(2.5), ...lineRule(theme.lineHeight) }, children: [run(ats(os.note, theme.nonBreakingHyphens), { italics: true, size: theme.sizeSmall })] }));
      }
      asArray<string>(os.items).forEach((it) => children.push(bullet([run(ats(it, theme.nonBreakingHyphens))])));
      if (os.url) children.push(new Paragraph({ spacing: { after: ptToTwip(2) }, children: [run("Full merged-PR history: ", { size: theme.sizeSmall }), link(os.urlLabel || os.url, os.url, theme.sizeSmall)] }));
    },
    projects: () => {
      const pr = content.projects || [];
      if (!pr.length) return;
      children.push(sectionHeading(SECTION_TITLES.projects));
      pr.forEach((p) => {
        const head = [new TextRun({ text: p.name || "", font: theme.fontFamily, bold: true, color: theme.accent, size: ptToHalf(theme.sizeBody) })];
        if (p.dateDisplay) head.push(new TextRun({ text: "  (" + p.dateDisplay + ")", font: theme.fontFamily, italics: true, color: theme.body, size: ptToHalf(theme.sizeSmall) }));
        children.push(new Paragraph({ spacing: { before: ptToTwip(3), after: ptToTwip(1) }, children: head }));
        if (p.association) children.push(new Paragraph({ spacing: { after: ptToTwip(1) }, children: [run(p.association, { italics: true, size: theme.sizeSmall })] }));
        if (p.description) children.push(new Paragraph({ spacing: { after: ptToTwip(2), ...lineRule(theme.lineHeight) }, children: [run(ats(p.description, theme.nonBreakingHyphens))] }));
        asArray<string>(p.highlights).forEach((h) => children.push(bullet([run(ats(h, theme.nonBreakingHyphens))])));
        if (asArray(p.links).length) {
          const linkRuns: any[] = [];
          asArray(p.links).forEach((u: any, i: number) => { if (i) linkRuns.push(run("  ·  ", { size: theme.sizeSmall })); linkRuns.push(link(u.label || u.url || "link", u.url || "#", theme.sizeSmall)); });
          children.push(new Paragraph({ spacing: { after: ptToTwip(2) }, children: linkRuns }));
        }
      });
    },
    certifications: () => {
      const cf = content.certifications || [];
      if (!cf.length) return;
      children.push(sectionHeading(SECTION_TITLES.certifications));
      if (content.certificationsNote) {
        if (content.certificationsNoteFlagged) children.push(commentedParagraph([run(content.certificationsNote, { italics: true, size: theme.sizeSmall })], "These beginner MOOCs (2020) predate professional experience and are consistently EXCLUDED from tailored resumes; kept for ground-truth completeness only."));
        else children.push(new Paragraph({ spacing: { after: ptToTwip(2.5), ...lineRule(theme.lineHeight) }, children: [run(content.certificationsNote, { italics: true, size: theme.sizeSmall })] }));
      }
      cf.forEach((c) => {
        const kids: any[] = [run(`${c.title || ""}${c.issuer ? " — " + c.issuer : ""}${c.date ? " (" + c.date + ")" : ""}  `)];
        if (c.url) kids.push(link("[" + (c.urlLabel || "certificate") + "]", c.url, theme.sizeSmall));
        children.push(bullet(kids));
      });
    },
    languages: () => {
      const lg = content.languages || [];
      if (!lg.length) return;
      children.push(sectionHeading(SECTION_TITLES.languages));
      const text = lg.map((l) => l.fluency ? `${l.language} (${l.fluency})` : l.language).filter(Boolean).join(", ");
      children.push(new Paragraph({ spacing: { after: ptToTwip(2) }, children: [run(text)] }));
    },
    recommendations: () => {
      const rc = content.recommendations || [];
      if (!rc.length) return;
      children.push(sectionHeading(SECTION_TITLES.recommendations));
      rc.forEach((r) => {
        children.push(new Paragraph({ spacing: { before: ptToTwip(2.5), after: ptToTwip(1), ...lineRule(theme.lineHeight) }, children: [
          run(`${r.by || ""}${r.role ? " — " + r.role : ""}`, { bold: true }),
          ...(r.relationship ? [run("  · " + r.relationship, { italics: true, size: theme.sizeSmall })] : []),
        ] }));
        if (r.text) children.push(new Paragraph({ spacing: { after: ptToTwip(2), ...lineRule(theme.lineHeight) }, children: [run("\u201C" + r.text + "\u201D", { italics: true })] }));
      });
    },
    companyContext: () => {
      const cc = content.companyContext || [];
      if (!cc.length) return;
      children.push(sectionHeading(SECTION_TITLES.companyContext));
      cc.forEach((c) => children.push(new Paragraph({ spacing: { before: ptToTwip(2), after: ptToTwip(1.5), ...lineRule(theme.lineHeight) }, children: [
        run((c.name || "") + " — ", { bold: true }), run(c.text || ""),
      ] })));
    },
  };

  // Determine section order: explicit list first, then any remaining canonical sections.
  const requested = (content.sectionOrder && content.sectionOrder.length ? content.sectionOrder : CANONICAL_ORDER).filter((s) => s in renderers);
  const seen = new Set(requested);
  const order = [...requested, ...CANONICAL_ORDER.filter((s) => !seen.has(s))];
  order.forEach((s) => renderers[s]());

  const doc = new Document({
    creator: "Resume Builder",
    title: (content.basics?.name || "Resume") + " — Generated",
    ...(commentsChildren.length ? { comments: { children: commentsChildren } } : {}),
    numbering: { config: [
      { reference: "bullets", levels: [ { level: 0, format: LevelFormat.BULLET, text: "\u2022", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 288, hanging: 180 } }, run: { color: theme.body } } } ] },
    ] },
    styles: { default: { document: { run: { font: theme.fontFamily, size: ptToHalf(theme.sizeBody), color: theme.body } } } },
    sections: [{
      properties: { page: {
        size: { width: US_LETTER.width, height: US_LETTER.height },
        margin: { top: inchToDxa(theme.margins.top), bottom: inchToDxa(theme.margins.bottom), left: inchToDxa(theme.margins.left), right: inchToDxa(theme.margins.right) },
      } },
      children,
    }],
  });

  return { doc, commentCount: commentsChildren.length };
}

function composeDates(start?: string, end?: string): string {
  if (!start && !end) return "";
  const e = end && end.trim() ? end : "Present";
  return start ? `${start} ${EN} ${e}` : e;
}
