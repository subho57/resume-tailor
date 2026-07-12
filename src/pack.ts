import { Packer, Document } from "docx";
import { execFileSync } from "child_process";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

// Pack a docx Document to a Buffer. As a safety net against the known v9
// "[object Object]" comment-id serialization bug, we unzip, repair any broken
// comment marker ids in document order, and rezip. With numeric ids this is a
// no-op, but it guarantees valid OOXML regardless of library version.
export async function packDocx(doc: Document, outPath: string): Promise<{ commentIdsFixed: number }> {
  const buf = await Packer.toBuffer(doc);
  fs.writeFileSync(outPath, buf);
  const fixed = repairCommentIds(outPath);
  return { commentIdsFixed: fixed };
}

// Unzip -> fix -> rezip using system unzip/zip (present in the environment).
function repairCommentIds(docxPath: string): number {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "docxfix-"));
  try {
    execFileSync("unzip", ["-q", docxPath, "-d", tmp]);
    const docXmlPath = path.join(tmp, "word", "document.xml");
    if (!fs.existsSync(docXmlPath)) return 0;
    let xml = fs.readFileSync(docXmlPath, "utf-8");
    if (!xml.includes("[object Object]")) return 0; // numeric ids -> nothing to do

    let n = 0;
    xml = xml.replace(/<w:(commentRangeStart|commentRangeEnd|commentReference)\s+w:id="\[object Object\]"(\s*)\/>/g,
      (_m, tag, sp) => { const id = Math.floor(n / 3); n++; return `<w:${tag} w:id="${id}"${sp}/>`; });
    fs.writeFileSync(docXmlPath, xml, "utf-8");

    // rezip: zip contents of tmp back into docxPath
    fs.rmSync(docxPath, { force: true });
    execFileSync("zip", ["-Xrq", docxPath, "."], { cwd: tmp });
    return Math.floor(n / 3);
  } catch {
    return 0;
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

// Convert docx -> pdf via LibreOffice headless. Serialized by nature (we call
// synchronously). Uses a private profile dir to avoid lock contention.
export function convertToPdf(docxPath: string, outDir: string): string {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "lo-"));
  try {
    execFileSync("soffice", [
      "--headless", `-env:UserInstallation=file://${profile}`,
      "--convert-to", "pdf:writer_pdf_Export", "--outdir", outDir, docxPath,
    ], { stdio: "ignore" });
  } catch {
    // fallback to the skill's soffice wrapper path if the direct binary differs
    try {
      execFileSync("python3", ["/mnt/skills/public/docx/scripts/office/soffice.py", "--headless", "--convert-to", "pdf", "--outdir", outDir, docxPath], { stdio: "ignore" });
    } catch { /* leave to caller to detect missing pdf */ }
  } finally {
    fs.rmSync(profile, { recursive: true, force: true });
  }
  const pdfName = path.basename(docxPath).replace(/\.docx$/i, ".pdf");
  return path.join(outDir, pdfName);
}

// Count PDF pages via pdfinfo (Poppler). Returns -1 if it cannot be determined.
export function countPdfPages(pdfPath: string): number {
  if (!fs.existsSync(pdfPath)) return -1;
  try {
    const out = execFileSync("pdfinfo", [pdfPath], { encoding: "utf-8" });
    const m = out.match(/Pages:\s+(\d+)/);
    return m ? parseInt(m[1], 10) : -1;
  } catch {
    return -1;
  }
}
