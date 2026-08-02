import { EditorView, basicSetup } from "codemirror";
import { json as jsonLang } from "@codemirror/lang-json";
import { Packer, Document } from "docx";
import { validate } from "../src/validate";
import { resolveTheme } from "../src/theme";
import { renderResume } from "../src/render";
import type { ResumeContent, Theme } from "../src/types";

import resumeSchema from "../schema/resume.schema.json";
import corporateNavy from "../themes/corporate-navy.theme.json";
import slateCompact from "../themes/slate-compact.theme.json";
import fictionalSample from "./examples/fictional-sample.resume.json";

const BUILTIN_THEMES: Record<string, Theme> = {
  "corporate-navy": corporateNavy as Theme,
  "slate-compact": slateCompact as Theme,
};

const THEME_PREVIEWS: Record<
  string,
  { name: string; desc: string; p: string; s: string; t: string }
> = {
  "corporate-navy": {
    name: "Corporate Navy",
    desc: "Polished 2-column header with deep navy headers and crisp corporate typography.",
    p: "#1a3a5c",
    s: "#4a5568",
    t: "#2d3748",
  },
  "slate-compact": {
    name: "Slate Compact",
    desc: "Single-page condensed layout with slate header accents and optimized margin spacing.",
    p: "#334155",
    s: "#64748b",
    t: "#1e293b",
  },
};

// Theme Management System (System Theme Default + Manual Override)
const themeToggleBtn = document.getElementById("theme-toggle") as HTMLButtonElement;
const MEDIA_DARK = window.matchMedia("(prefers-color-scheme: dark)");

// Clear legacy auto-saved key from early prototype if user didn't explicitly toggle
if (!sessionStorage.getItem("theme-toggled-this-session")) {
  localStorage.removeItem("resume-tailor-theme");
}

function getSavedTheme(): "dark" | "light" | null {
  const saved = localStorage.getItem("resume-tailor-theme");
  if (saved === "dark" || saved === "light") {
    return saved;
  }
  return null;
}

function updateThemeUI() {
  const saved = getSavedTheme();
  if (saved) {
    document.documentElement.setAttribute("data-theme", saved);
  } else {
    // Remove data-theme attribute so CSS @media (prefers-color-scheme) handles OS system theme natively!
    document.documentElement.removeAttribute("data-theme");
  }
}

// Initial theme sync
updateThemeUI();

// Live listener for OS system theme changes
MEDIA_DARK.addEventListener("change", () => {
  if (!getSavedTheme()) {
    updateThemeUI();
  }
});

// User manual toggle override
themeToggleBtn?.addEventListener("click", () => {
  sessionStorage.setItem("theme-toggled-this-session", "true");
  const saved = getSavedTheme();
  const systemIsDark = MEDIA_DARK.matches;
  const currentEffective = saved || (systemIsDark ? "dark" : "light");
  const nextTheme = currentEffective === "dark" ? "light" : "dark";

  localStorage.setItem("resume-tailor-theme", nextTheme);
  updateThemeUI();
});

// DOM Elements
const editorContainer = document.getElementById("editor")!;
const themeSelect = document.getElementById("theme-select") as HTMLSelectElement;
const generateButton = document.getElementById("generate") as HTMLButtonElement;
const resetJsonButton = document.getElementById("btn-reset-json") as HTMLButtonElement;
const copyInstallBtn = document.getElementById("btn-copy-install") as HTMLButtonElement;
const cmdInstallCode = document.getElementById("cmd-install") as HTMLElement;

const warningsPanel = document.getElementById("warnings")!;
const statusPanel = document.getElementById("status")!;

// Theme Preview Elements
const themePreviewName = document.getElementById("theme-preview-name")!;
const themePreviewDesc = document.getElementById("theme-preview-desc")!;
const swatch1 = document.getElementById("swatch-1")!;
const swatch2 = document.getElementById("swatch-2")!;
const swatch3 = document.getElementById("swatch-3")!;

// Initialize CodeMirror Editor
const editor = new EditorView({
  doc: JSON.stringify(fictionalSample, null, 2),
  extensions: [
    basicSetup,
    jsonLang(),
  ],
  parent: editorContainer,
});

// Update Theme Preview Box
function updateThemePreview(themeKey: string) {
  const meta = THEME_PREVIEWS[themeKey] || THEME_PREVIEWS["corporate-navy"];
  themePreviewName.textContent = meta.name;
  themePreviewDesc.textContent = meta.desc;
  swatch1.style.backgroundColor = meta.p;
  swatch2.style.backgroundColor = meta.s;
  swatch3.style.backgroundColor = meta.t;
}

themeSelect.addEventListener("change", () => {
  updateThemePreview(themeSelect.value);
});

// Initial theme preview set
updateThemePreview(themeSelect.value);

// Reset JSON Sample
resetJsonButton.addEventListener("click", () => {
  editor.dispatch({
    changes: {
      from: 0,
      to: editor.state.doc.length,
      insert: JSON.stringify(fictionalSample, null, 2),
    },
  });
  showWarnings([]);
  showStatus("", false);
});

// Copy Install Command
copyInstallBtn?.addEventListener("click", async () => {
  const text = cmdInstallCode.textContent || "";
  try {
    await navigator.clipboard.writeText(text);
    const copyTextSpan = copyInstallBtn.querySelector(".copy-text");
    if (copyTextSpan) {
      const original = copyTextSpan.textContent;
      copyTextSpan.textContent = "Copied!";
      setTimeout(() => {
        copyTextSpan.textContent = original;
      }, 2000);
    }
  } catch (err) {
    console.error("Failed to copy:", err);
  }
});

// Copy Code Snippets (Tabs)
document.querySelectorAll(".copy-code-btn").forEach((btn) => {
  btn.addEventListener("click", async () => {
    const targetId = btn.getAttribute("data-target");
    if (!targetId) return;
    const targetEl = document.getElementById(targetId);
    if (!targetEl) return;

    try {
      await navigator.clipboard.writeText(targetEl.textContent || "");
      const orig = btn.textContent;
      btn.textContent = "Copied!";
      setTimeout(() => {
        btn.textContent = orig;
      }, 2000);
    } catch (e) {
      console.error(e);
    }
  });
});

// Tab Switching Logic
document.querySelectorAll(".tab-btn").forEach((tabBtn) => {
  tabBtn.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
    document.querySelectorAll(".tab-content").forEach((c) => c.classList.remove("active"));

    tabBtn.classList.add("active");
    const targetTab = tabBtn.getAttribute("data-tab");
    if (targetTab) {
      document.getElementById(targetTab)?.classList.add("active");
    }
  });
});

function showWarnings(messages: string[]) {
  warningsPanel.innerHTML = "";
  if (messages.length === 0) {
    warningsPanel.style.display = "none";
    return;
  }
  warningsPanel.style.display = "block";
  const title = document.createElement("strong");
  title.textContent = "Schema Warnings:";
  warningsPanel.appendChild(title);

  const list = document.createElement("ul");
  for (const msg of messages) {
    const item = document.createElement("li");
    item.textContent = msg;
    list.appendChild(item);
  }
  warningsPanel.appendChild(list);
}

function showStatus(message: string, isError: boolean) {
  if (!message) {
    statusPanel.style.display = "none";
    return;
  }
  statusPanel.style.display = "block";
  statusPanel.textContent = message;
  statusPanel.className = isError ? "status-box error" : "status-box success";
}

generateButton.addEventListener("click", async () => {
  showWarnings([]);
  showStatus("", false);

  const origButtonHtml = generateButton.innerHTML;
  generateButton.disabled = true;
  generateButton.innerHTML = `<span>Rendering...</span>`;

  let content: ResumeContent;
  try {
    content = JSON.parse(editor.state.doc.toString());
  } catch (e) {
    showStatus(`Invalid JSON syntax: ${(e as Error).message}`, true);
    generateButton.disabled = false;
    generateButton.innerHTML = origButtonHtml;
    return;
  }

  const contentWarnings = validate(resumeSchema, content);
  const themeRaw = BUILTIN_THEMES[themeSelect.value] ?? BUILTIN_THEMES["corporate-navy"];
  const theme = resolveTheme(themeRaw);

  if (contentWarnings.length > 0) {
    showWarnings(contentWarnings.map((w) => `${w.path}: ${w.message}`));
  }

  try {
    const { doc } = renderResume(content, theme, []);
    const blob = await Packer.toBlob(doc as Document);
    const url = URL.createObjectURL(blob);
    const basename = (content.basics?.name || "resume").replace(/[^\w.-]+/g, "_");
    const a = document.createElement("a");
    a.href = url;
    a.download = `${basename}.docx`;
    a.click();
    URL.revokeObjectURL(url);
    showStatus("✅ Resume generated successfully! Check your downloads.", false);
  } catch (e) {
    showStatus(`Render failed: ${(e as Error).message}`, true);
  } finally {
    generateButton.disabled = false;
    generateButton.innerHTML = origButtonHtml;
  }
});
