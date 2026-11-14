import { mkdtemp, symlink, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { inspectPdf } from './inspect.mjs';

async function fixture(script) {
  const root = await mkdtemp(join(tmpdir(), 'trendie-pdf-'));
  await writeFile(join(root, 'sample.pdf'), '%PDF-fixture');
  const scriptPath = join(root, 'runner.mjs');
  await writeFile(scriptPath, script);
  return { root, scriptPath, cleanup: () => rm(root, { recursive: true, force: true }) };
}
const good = `process.stdout.write(JSON.stringify({provenance:'synthetic-or-user-local-document',pages:[{page:1,text:'ok'}],pageCount:1,textChars:2,limitations:['advisory']}));`;

describe('PDF process boundary', () => {
  it('accepts valid output and rejects malformed shape', async () => {
    const valid = await fixture(good);
    try { expect((await inspectPdf({ path: 'sample.pdf', allowlistedRoot: valid.root, python: process.execPath, scriptPath: valid.scriptPath })).pageCount).toBe(1); }
    finally { await valid.cleanup(); }
    const malformed = await fixture(`process.stdout.write(JSON.stringify({pages:[],pageCount:1,textChars:0}));`);
    try { await expect(inspectPdf({ path: 'sample.pdf', allowlistedRoot: malformed.root, python: process.execPath, scriptPath: malformed.scriptPath })).rejects.toThrow('invalid output'); }
    finally { await malformed.cleanup(); }
  });

  it('counts supplementary Unicode text in Python code points', async () => {
    const supplementary = await fixture(`process.stdout.write(JSON.stringify({provenance:'synthetic-or-user-local-document',pages:[{page:1,text:'🍸𐀀'}],pageCount:1,textChars:2,limitations:[]}));`);
    try {
      const result = await inspectPdf({ path: 'sample.pdf', allowlistedRoot: supplementary.root, python: process.execPath, scriptPath: supplementary.scriptPath });
      expect(result.textChars).toBe(2);
    } finally { await supplementary.cleanup(); }
  });

  it('kills a hung child and bounds stdout and stderr', async () => {
    const hung = await fixture(`setInterval(()=>{},1000);`);
    try { await expect(inspectPdf({ path: 'sample.pdf', allowlistedRoot: hung.root, python: process.execPath, scriptPath: hung.scriptPath, timeoutMs: 20 })).rejects.toThrow('timed out'); }
    finally { await hung.cleanup(); }
    const out = await fixture(`process.stdout.write('x'.repeat(1_000_001)); setInterval(()=>{},1000);`);
    try { await expect(inspectPdf({ path: 'sample.pdf', allowlistedRoot: out.root, python: process.execPath, scriptPath: out.scriptPath })).rejects.toThrow('output limit'); }
    finally { await out.cleanup(); }
    const err = await fixture(`process.stderr.write('x'.repeat(16_385)); setInterval(()=>{},1000);`);
    try { await expect(inspectPdf({ path: 'sample.pdf', allowlistedRoot: err.root, python: process.execPath, scriptPath: err.scriptPath })).rejects.toThrow('error output limit'); }
    finally { await err.cleanup(); }
  });

  it('rejects traversal and symlinks escaping the trusted root', async () => {
    const root = await mkdtemp(join(tmpdir(), 'trendie-pdf-root-'));
    const outside = await mkdtemp(join(tmpdir(), 'trendie-pdf-out-'));
    try {
      await writeFile(join(outside, 'outside.pdf'), '%PDF-fixture');
      await symlink(join(outside, 'outside.pdf'), join(root, 'escape.pdf'));
      await expect(inspectPdf({ path: '../outside.pdf', allowlistedRoot: root })).rejects.toThrow('outside');
      await expect(inspectPdf({ path: 'escape.pdf', allowlistedRoot: root })).rejects.toThrow('outside');
    } finally { await rm(root, { recursive: true, force: true }); await rm(outside, { recursive: true, force: true }); }
  });
});
