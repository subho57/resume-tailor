import { Packer, Document } from "docx";
import { $ } from "bun";
import { mkdtempSync, rmSync } from "node:fs";
import { basename, join } from "node:path";
import { tmpdir } from "node:os";

// Pack a docx Document to a Buffer. As a safety net against the known v9
// "[object Object]" comment-id serialization bug, we unzip, repair any broken
// comment marker ids in document order, and rezip. With numeric ids this is a
// no-op, but it guarantees valid OOXML regardless of library version.
export async function packDocx(doc: Document, outPath: string): Promise<{ commentIdsFixed: number }> {
  const buf = await Packer.toBuffer(doc);
  await Bun.write(outPath, buf); // buf is a raw docx Buffer, not text — pass through as-is
  const fixed = await repairCommentIds(outPath);
  return { commentIdsFixed: fixed };
}

// Unzip -> fix -> rezip using system unzip/zip (present in the environment).
async function repairCommentIds(docxPath: string): Promise<number> {
  const tmp = mkdtempSync(join(tmpdir(), "docxfix-"));
  try {
    await $`unzip -q ${docxPath} -d ${tmp}`.quiet();
    const docXmlPath = join(tmp, "word", "document.xml");
    if (!(await Bun.file(docXmlPath).exists())) return 0;
    let xml = await Bun.file(docXmlPath).text();
    if (!xml.includes("[object Object]")) return 0; // numeric ids -> nothing to do

    let n = 0;
    xml = xml.replace(/<w:(commentRangeStart|commentRangeEnd|commentReference)\s+w:id="\[object Object\]"(\s*)\/>/g,
      (_m, tag, sp) => { const id = Math.floor(n / 3); n++; return `<w:${tag} w:id="${id}"${sp}/>`; });
    await Bun.write(docXmlPath, xml);

    // rezip: zip contents of tmp back into docxPath
    rmSync(docxPath, { force: true });
    await $`zip -Xrq ${docxPath} .`.cwd(tmp).quiet();
    return Math.floor(n / 3);
  } catch {
    return 0;
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

// Detect presence of the external PDF toolchain (LibreOffice + Poppler) without
// spawning anything, so callers can surface an actionable warning up front instead
// of a vague post-hoc "conversion failed" message. Bun-only (this is a Bun repo).
function binaryExists(bin: string): boolean {
  return !!Bun.which(bin);
}

export function checkPdfToolchain(): { soffice: boolean; pdfinfo: boolean } {
  return { soffice: binaryExists("soffice"), pdfinfo: binaryExists("pdfinfo") };
}

// Convert docx -> pdf via LibreOffice headless. Uses a private profile dir to
// avoid lock contention.
//
// KNOWN ISSUE: under rapid repeated conversions against the same directory (e.g.
// autofit's measure() loop), soffice/pdfinfo can occasionally produce a stably-wrong
// (not flaky/fluctuating) page count for reasons not fully root-caused — deleting any
// pre-existing file at the target path first at least prevents a stale *previous*
// file from being silently re-read as the current result. See autofit.ts's
// DEBUG_AUTOFIT trace and the -1-vs-"fits" handling in its loop for related context;
// this is a pre-existing reliability gap in the pipeline, not something introduced by
// any single caller.
export async function convertToPdf(docxPath: string, outDir: string): Promise<string> {
  const pdfName = basename(docxPath).replace(/\.docx$/i, ".pdf");
  const pdfPath = join(outDir, pdfName);
  rmSync(pdfPath, { force: true });

  const profile = mkdtempSync(join(tmpdir(), "lo-"));
  try {
    await $`soffice --headless -env:UserInstallation=file://${profile} --convert-to pdf:writer_pdf_Export --outdir ${outDir} ${docxPath}`.quiet();
  } catch {
    // fallback to the skill's soffice wrapper path if the direct binary differs
    try {
      await $`python3 /mnt/skills/public/docx/scripts/office/soffice.py --headless --convert-to pdf --outdir ${outDir} ${docxPath}`.quiet();
    } catch { /* leave to caller to detect missing pdf */ }
  } finally {
    rmSync(profile, { recursive: true, force: true });
  }
  return pdfPath;
}

// Count PDF pages via pdfinfo (Poppler). Returns -1 if it cannot be determined.
export async function countPdfPages(pdfPath: string): Promise<number> {
  if (!(await Bun.file(pdfPath).exists())) return -1;
  try {
    const out = await $`pdfinfo ${pdfPath}`.quiet().text();
    const m = out.match(/Pages:\s+(\d+)/);
    return m ? parseInt(m[1], 10) : -1;
  } catch {
    return -1;
  }
}
