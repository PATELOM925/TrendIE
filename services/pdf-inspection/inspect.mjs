import { spawn } from 'node:child_process';
import { realpath, stat } from 'node:fs/promises';
import { resolve, sep, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const serviceDir = dirname(fileURLToPath(import.meta.url));
const maxOutput = 1_000_000;

export async function inspectPdf({ path, allowlistedRoot, python = 'python3' }) {
  if (!path || !allowlistedRoot) throw new TypeError('A local PDF path and allowlisted root are required');
  const root = await realpath(resolve(allowlistedRoot));
  const file = await realpath(resolve(root, path));
  if (!file.startsWith(root + sep)) throw new Error('PDF path is outside the allowlisted root');
  const info = await stat(file);
  if (!info.isFile() || info.size > 5_000_000) throw new Error('PDF file is not eligible for inspection');
  const script = resolve(serviceDir, 'inspect_pdf.py');
  return await new Promise((resolveResult, reject) => {
    const child = spawn(python, [script, file], { shell: false, stdio: ['ignore', 'pipe', 'pipe'], timeout: 5_000, windowsHide: true });
    let stdout = '';
    let stderr = '';
    let bytes = 0;
    child.stdout.setEncoding('utf8').on('data', (chunk) => { bytes += Buffer.byteLength(chunk); if (bytes > maxOutput) child.kill('SIGKILL'); else stdout += chunk; });
    child.stderr.setEncoding('utf8').on('data', (chunk) => { stderr += chunk.slice(0, 500); });
    child.once('error', () => reject(new Error('PDF inspection process could not start')));
    child.once('close', (code) => {
      if (code !== 0) return reject(new Error(`PDF inspection failed: ${stderr.trim().slice(0, 200) || 'bounded process error'}`));
      try { resolveResult(JSON.parse(stdout)); } catch { reject(new Error('PDF inspection returned invalid output')); }
    });
  });
}
