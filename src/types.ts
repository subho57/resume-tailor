// ============================================================================
// Type definitions for the resume content document and theme preset.
// These mirror schema/resume.schema.json and schema/theme.schema.json.
// Nearly everything is optional to support partial / tailored documents.
// ============================================================================

export interface Location {
  address?: string;
  postalCode?: string;
  city?: string;
  region?: string;
  countryCode?: string;
  display?: string;
}

export interface Profile {
  network?: string;
  username?: string;
  url?: string;
  display?: string;
}

export interface Basics {
  name?: string;
  label?: string;
  email?: string;
  phone?: string;
  url?: string;
  location?: Location;
  profiles?: Profile[];
  summary?: string;
  summaries?: Record<string, string>;
  activeSummary?: string;
}

export interface Preferences {
  locations?: string[];
  hybrid?: string;
  roles?: string[];
}

export interface Role {
  position?: string;
  startDate?: string;
  endDate?: string;
  dateDisplay?: string;
}

export type Highlight =
  | string
  | { text?: string; alt?: string; flagged?: boolean; note?: string };

export interface Work {
  name?: string;
  location?: string;
  url?: string;
  domainNote?: string;
  position?: string;
  startDate?: string;
  endDate?: string;
  dateDisplay?: string;
  roles?: Role[];
  summary?: string;
  highlights?: Highlight[];
}

export interface Education {
  institution?: string;
  location?: string;
  url?: string;
  area?: string;
  studyType?: string;
  degreeDisplay?: string;
  startDate?: string;
  endDate?: string;
  dateDisplay?: string;
  score?: string;
  scoreFlagged?: boolean;
  scoreNote?: string;
  courses?: string[];
  detail?: string;
}

export interface SkillGroup {
  name?: string;
  level?: string;
  keywords?: string[];
  keywordsText?: string;
}

export interface OpenSource {
  headline?: string;
  note?: string;
  noteFlagged?: boolean;
  items?: string[];
  url?: string;
  urlLabel?: string;
}

export interface ProjectLink {
  label?: string;
  url?: string;
}

export interface Project {
  name?: string;
  dateDisplay?: string;
  association?: string;
  description?: string;
  highlights?: string[];
  links?: ProjectLink[];
}

export interface Certification {
  title?: string;
  issuer?: string;
  date?: string;
  url?: string;
  urlLabel?: string;
}

export interface Language {
  language?: string;
  fluency?: string;
}

export interface Recommendation {
  by?: string;
  role?: string;
  relationship?: string;
  text?: string;
}

export interface CompanyContext {
  name?: string;
  text?: string;
}

export type SectionName =
  | "about" | "preferences" | "summary" | "skills" | "work" | "education"
  | "openSource" | "projects" | "certifications" | "languages"
  | "recommendations" | "companyContext";

export interface ResumeContent {
  schemaVersion?: string;
  theme?: string;
  sectionOrder?: SectionName[];
  about?: string;
  basics?: Basics;
  preferences?: Preferences;
  work?: Work[];
  education?: Education[];
  skills?: SkillGroup[];
  openSource?: OpenSource;
  projects?: Project[];
  certifications?: Certification[];
  certificationsNote?: string;
  certificationsNoteFlagged?: boolean;
  languages?: Language[];
  recommendations?: Recommendation[];
  companyContext?: CompanyContext[];
}

// ---- Theme ----
export interface Theme {
  name?: string;
  font?: { family?: string; baseSize?: number };
  sizes?: { name?: number | null; sectionHeading?: number | null; body?: number | null; small?: number | null };
  colors?: { accent?: string; body?: string; rule?: string; link?: string };
  margins?: { top?: number; right?: number; bottom?: number; left?: number };
  spacing?: { sectionBefore?: number; sectionAfter?: number; bulletAfter?: number; lineHeight?: number };
  header?: { leftCellPct?: number };
  ats?: { nonBreakingHyphens?: boolean };
  autofit?: {
    minBodySize?: number; minMargin?: number; fontStep?: number;
    marginStep?: number; spacingStep?: number; maxIterations?: number;
  };
}

// Fully-resolved theme (all defaults applied) used by the renderer.
export interface ResolvedTheme {
  name: string;
  fontFamily: string;
  baseSize: number;
  sizeName: number;
  sizeSectionHeading: number;
  sizeBody: number;
  sizeSmall: number;
  accent: string;
  body: string;
  rule: string;
  link: string;
  margins: { top: number; right: number; bottom: number; left: number };
  sectionBefore: number;
  sectionAfter: number;
  bulletAfter: number;
  lineHeight: number;
  leftCellPct: number;
  nonBreakingHyphens: boolean;
  autofit: {
    minBodySize: number; minMargin: number; fontStep: number;
    marginStep: number; spacingStep: number; maxIterations: number;
  };
}
