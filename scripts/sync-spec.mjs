// Reproducible private mirror. REQUESTS.md is private workshop state, never source material; the source's
// AGENTS.md instructs agents editing the canonical repository and would mislead them inside this copy.
import { readFileSync, writeFileSync, readdirSync, mkdirSync, rmSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
const args = process.argv.slice(2);
/**
 * Read the token after the first named CLI option, or undefined when absent; required-value checks belong
 * to the selected mode.
 */
const option = name => args.includes(name) ? args[args.indexOf(name) + 1] : undefined;
const mirror = resolve(import.meta.dirname, '../spec');
/** Hash exact file bytes as SHA-256 hex for the mirror manifest and revision comparison. */
const digest = b => createHash('sha256').update(b).digest('hex');
/**
 * List sorted relative mirror paths recursively, excluding Git, dependencies, local metadata and private
 * REQUESTS.md; filesystem errors propagate.
 */
const skipped = ['.git','node_modules','.DS_Store','REQUESTS.md','AGENTS.md','MIRROR.json'];
const inventory = dir => readdirSync(dir, { withFileTypes: true }).flatMap(e => skipped.includes(e.name) ? [] : e.isDirectory() ? inventory(join(dir,e.name)).map(p => `${e.name}/${p}`) : [e.name]).sort();
/**
 * Map the sorted mirror inventory to exact byte hashes, retaining deterministic key order for manifest
 * comparison.
 */
const hashes = dir => Object.fromEntries(inventory(dir).map(p => [p, digest(readFileSync(join(dir,p)))]));
const source = option('--source'), revision = option('--revision');
/**
 * Run Git in the explicitly selected source checkout, returning raw stdout with a 20 MiB cap; command
 * failures propagate to the static sync diagnostic.
 */
const run = (...a) => execFileSync('git', ['-C', resolve(source), ...a], { maxBuffer: 20 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"] });
try {
  if (args.includes('--check')) {
    const manifest = JSON.parse(readFileSync(join(mirror,'MIRROR.json'),'utf8'));
    if (JSON.stringify(hashes(mirror)) !== JSON.stringify(manifest.files)) throw Error('MIRROR_DRIFT');
    if (source && JSON.stringify(hashes(resolve(source))) !== JSON.stringify(manifest.files)) throw Error('SOURCE_DRIFT');
    if (args.includes('--require-pinned') && (!manifest.source_revision || manifest.dirty)) throw Error('SOURCE_UNPINNED');
    if (revision && manifest.source_revision !== revision) throw Error('REVISION_MISMATCH');
    console.log(`mirror: hashes verified (${manifest.source_revision ?? 'dirty working snapshot; not pinned'})`);
  } else {
    if (!source || !revision || !/^[a-f0-9]{40}$/.test(revision)) throw Error('SOURCE_AND_FULL_REVISION_REQUIRED');
    run('cat-file','-e',`${revision}^{commit}`);
    const files = hashes(resolve(source));
    const dirty = Object.entries(files).some(([p,h]) => {
      try { return digest(run('show',`${revision}:${p}`)) !== h; } catch { return true; }
    }) || run('ls-tree','-r','--name-only',revision).toString().trim().split('\n').some(p => !skipped.includes(p.split('/').pop()) && !Object.hasOwn(files,p));
    if (dirty && !args.includes('--allow-dirty')) throw Error('SOURCE_DIRTY_AT_REVISION');
    for (const p of inventory(mirror)) rmSync(join(mirror,p));
    for (const p of Object.keys(files)) { mkdirSync(dirname(join(mirror,p)),{recursive:true}); writeFileSync(join(mirror,p),readFileSync(join(resolve(source),p))); }
    writeFileSync(join(mirror,'MIRROR.json'),JSON.stringify({ source_repository:'https://github.com/cmdai-hq/HUMANS.md', source_revision:dirty ? null : revision, base_revision:revision, dirty, files },null,2)+'\n');
    console.log(`mirror: synchronized ${Object.keys(files).length} files (${dirty ? 'uncommitted snapshot, repin after commit' : revision})`);
  }
} catch (e) { console.error(['MIRROR_DRIFT','SOURCE_DRIFT','REVISION_MISMATCH','SOURCE_AND_FULL_REVISION_REQUIRED','SOURCE_DIRTY_AT_REVISION','SOURCE_UNPINNED'].includes(e.message) ? e.message : 'MIRROR_SYNC_FAILED'); process.exitCode = 1; }
