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

const editorContainer = document.getElementById("editor")!;
const themeSelect = document.getElementById("theme-select") as HTMLSelectElement;
const generateButton = document.getElementById("generate") as HTMLButtonElement;
const warningsPanel = document.getElementById("warnings")!;
const statusPanel = document.getElementById("status")!;

const editor = new EditorView({
  doc: JSON.stringify(fictionalSample, null, 2),
  extensions: [basicSetup, jsonLang()],
  parent: editorContainer,
});

function showWarnings(messages: string[]) {
  warningsPanel.innerHTML = "";
  if (messages.length === 0) return;
  const list = document.createElement("ul");
  for (const msg of messages) {
    const item = document.createElement("li");
    item.textContent = msg;
    list.appendChild(item);
  }
  warningsPanel.appendChild(list);
}

function showStatus(message: string, isError: boolean) {
  statusPanel.textContent = message;
  statusPanel.className = isError ? "status error" : "status success";
}

generateButton.addEventListener("click", async () => {
  showWarnings([]);
  showStatus("", false);

  let content: ResumeContent;
  try {
    content = JSON.parse(editor.state.doc.toString());
  } catch (e) {
    showStatus(`Invalid JSON: ${(e as Error).message}`, true);
    return;
  }

  const contentWarnings = validate(resumeSchema, content);
  // No theme validation here (unlike the CLI's main()) — themeRaw is always one of
  // our own bundled built-in presets, selected from a fixed dropdown, never
  // user-edited JSON, so there's nothing for validate() to usefully catch.
  const themeRaw = BUILTIN_THEMES[themeSelect.value] ?? BUILTIN_THEMES["corporate-navy"];
  const theme = resolveTheme(themeRaw);

  if (contentWarnings.length > 0) {
    showWarnings(contentWarnings.map((w) => `${w.path}: ${w.message}`));
  }

  try {
    // No comment-repair pass here, unlike the CLI's packDocx() — that step shells
    // out to unzip/zip to work around a docx v9 bug where flagged-highlight Word
    // comments can serialize as "[object Object]", and unzip/zip aren't available
    // in a browser. Only matters if the JSON has `flagged: true` highlights; see
    // the on-page note next to the editor.
    const { doc } = renderResume(content, theme, []);
    const blob = await Packer.toBlob(doc as Document);
    const url = URL.createObjectURL(blob);
    const basename = (content.basics?.name || "resume").replace(/[^\w.-]+/g, "_");
    const a = document.createElement("a");
    a.href = url;
    a.download = `${basename}.docx`;
    a.click();
    URL.revokeObjectURL(url);
    showStatus("Generated — check your downloads.", false);
  } catch (e) {
    showStatus(`Render failed: ${(e as Error).message}`, true);
  }
});
