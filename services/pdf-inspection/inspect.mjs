import { spawn } from 'node:child_process';
import { realpath, stat } from 'node:fs/promises';
import { resolve, sep, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const serviceDir = dirname(fileURLToPath(import.meta.url));
const MAX_OUTPUT_BYTES = 1_000_000;
const MAX_STDERR_BYTES = 16_384;
const MAX_PAGES = 20;
const MAX_TEXT_CHARS = 100_000;

function validateOutput(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).sort().join(',') !== 'limitations,pageCount,pages,provenance,textChars' || value.provenance !== 'synthetic-or-user-local-document' || !Array.isArray(value.pages) || !Number.isSafeInteger(value.pageCount) || value.pageCount < 1 || value.pageCount > MAX_PAGES || value.pages.length !== value.pageCount || !Number.isSafeInteger(value.textChars) || value.textChars < 0 || value.textChars > MAX_TEXT_CHARS || !Array.isArray(value.limitations) || value.limitations.length > 10 || value.limitations.some((item) => typeof item !== 'string' || item.length > 300)) throw new Error('PDF inspection returned invalid output');
  let chars = 0;
  for (let index = 0; index < value.pages.length; index += 1) {
    const page = value.pages[index];
    if (!page || typeof page !== 'object' || Array.isArray(page) || Object.keys(page).sort().join(',') !== 'page,text' || page.page !== index + 1 || typeof page.text !== 'string') throw new Error('PDF inspection returned invalid output');
    chars += page.text.length;
  }
  if (chars !== value.textChars) throw new Error('PDF inspection returned invalid output');
  return value;
}

export async function inspectPdf({ path, allowlistedRoot, python = 'python3', timeoutMs = 5_000, spawnImpl = spawn, scriptPath = resolve(serviceDir, 'inspect_pdf.py') }) {
  if (!path || !allowlistedRoot) throw new TypeError('A local PDF path and allowlisted root are required');
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 30_000) throw new RangeError('Invalid PDF inspection timeout');
  const root = await realpath(resolve(allowlistedRoot));
  const file = await realpath(resolve(root, path));
  if (!file.startsWith(root + sep)) throw new Error('PDF path is outside the allowlisted root');
  const info = await stat(file);
  if (!info.isFile() || info.size > 5_000_000) throw new Error('PDF file is not eligible for inspection');
  return await new Promise((resolveResult, reject) => {
    let stdout = '';
    let stdoutBytes = 0;
    let stderrBytes = 0;
    let settled = false;
    let oversized = false;
    const finish = (error, result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (error) reject(error); else resolveResult(result);
    };
    const child = spawnImpl(python, [scriptPath, file], { shell: false, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
    const timer = setTimeout(() => { child.kill('SIGKILL'); finish(new Error('PDF inspection timed out')); }, timeoutMs);
    child.stdout.setEncoding('utf8').on('data', (chunk) => {
      stdoutBytes += Buffer.byteLength(chunk);
      if (stdoutBytes > MAX_OUTPUT_BYTES) { oversized = true; child.kill('SIGKILL'); finish(new Error('PDF inspection output limit exceeded')); return; }
      stdout += chunk;
    });
    child.stderr.on('data', (chunk) => {
      stderrBytes += Buffer.byteLength(chunk);
      if (stderrBytes > MAX_STDERR_BYTES) { oversized = true; child.kill('SIGKILL'); finish(new Error('PDF inspection error output limit exceeded')); }
    });
    child.once('error', () => finish(new Error('PDF inspection process could not start')));
    child.once('close', (code) => {
      if (settled) return;
      if (oversized || code !== 0) return finish(new Error('PDF inspection process failed'));
      try { finish(null, validateOutput(JSON.parse(stdout))); } catch { finish(new Error('PDF inspection returned invalid output')); }
    });
  });
}
