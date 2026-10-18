// Bounded synthetic mutation checks in disposable copies. Never edit the working implementation.
import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, readFileSync, writeFileSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { specDir } from './lib.mjs';
const scratch = mkdtempSync(join(tmpdir(),'humans-mutations-'));
try {
  cpSync(specDir,join(scratch,'spec'),{recursive:true,/** Exclude copy paths containing /node_modules or /.git from the disposable mutation tree. */ filter:p => !p.includes('/node_modules') && !p.includes('/.git')});
  const root = join(scratch,'spec/tools');
  symlinkSync(join(specDir,'tools/node_modules'),join(root,'node_modules'),'dir');
  const mutations = [
    ['front-limit', 'encode(front).length > MAX_FRONTMATTER_BYTES', 'encode(front).length > MAX_FRONTMATTER_BYTES + 1'],
    ['body-limit', 'encode(body).length > MAX_BODY_BYTES', 'encode(body).length > MAX_BODY_BYTES + 1'],
    ['final-newline-count', 'encode(front).length', "encode(front.replace(/\\r?\\n$/, '')).length"],
    ['decoded-duplicates', 'uniqueKeys: true', 'uniqueKeys: false', 'yaml-data.mjs'],
    ['fatal-utf8', 'fatal: true', 'fatal: false'],
    ['year-0-99', "const [y, month, day] = m.slice(1).map(Number);", "const [y, month, day] = m.slice(1).map(Number); if (y < 100) return false;"],
    ['chosen-health-preserved', "const withheld = typeof profile.notes", "if (profile.notes === 'I have ADHD.') return invalid(); const withheld = typeof profile.notes"],
    ['surrogate-before-filter', 'if (!jsonScalar(value))', 'if (false)', 'yaml-data.mjs'],
    ['unknown-depth-cutoff', 'const values = new Map();', "if (collections.length > 500) throw Error('PROFILE_INVALID'); const values = new Map();", 'yaml-data.mjs'],
    ['unknown-cli-flag', "if (args.some(a => a.startsWith('-')", "if (false && args.some(a => a.startsWith('-')", 'validate.mjs'],
    ['merge-selector-presence', "Object.hasOwn(options, 'state') || Object.hasOwn(options, 'activeStates')", "options.state || options.activeStates", 'merge.mjs'],
    ['merge-cli-selector', 'try { rejectSelectors(c); }', 'try { /* selector guard removed */ }', 'merge.mjs'],
    ['expect-invalid-unavailable', '!unavailable && (!!result.profile !== expectInvalid)', '(!!result.profile !== expectInvalid)', 'validate.mjs'],
    ['oversize-unavailable', "error.code === 'PROFILE_INVALID'", 'false', 'validate.mjs'],
    ['previous-version-read', "Object.freeze(['0.3', '0.2'])", "Object.freeze(['0.3'])"],
    ['quiet-hours-equal-range', 'if (isMap(quiet) && quiet.from === quiet.to)', 'if (false)'],
    ['required-member-omitted', 'if (filterEnums && node.required?.some(', 'if (false && node.required?.some('],
    ['previous-public-mapping', "raw.humans === '0.2' && data.visibility === 'public'", 'false'],
  ];
  /**
   * Run the reference test file in the disposable tools copy with a 180-second timeout;
   * return the subprocess result for the mutation assertions.
   */
  const run = () => spawnSync(process.execPath,['--test','test.mjs'],{cwd:root,encoding:'utf8',timeout:180000});
  assert.equal(run().status,0,'unmutated temporary control must pass');
  for (const [name,from,to,filename = 'reader-core.mjs'] of mutations) {
    const file = join(root,filename), original = readFileSync(file,'utf8');
    assert.equal(original.split(from).length,2,`${name}: exact mutation site`);
    writeFileSync(file,original.replace(from,to));
    const r = run();
    assert.equal(r.status,1,`${name} survived or failed to run`);
    assert.match(r.stdout,/shared parser vectors/,'test runner reached assertions');
    assert.match(r.stdout,/ERR_ASSERTION|AssertionError/,'mutation must be killed by an assertion');
    assert.doesNotMatch(r.stdout + r.stderr,/SyntaxError|ERR_MODULE_NOT_FOUND/,'mutation must execute');
    writeFileSync(file,original);
    console.log(`KILLED ${name}`);
  }
  assert.equal(run().status,0,'restored control must pass');
  console.log(`PASS ${mutations.length} mutations; medical-blacklist removal is not a defect mutation`);
} finally { rmSync(scratch,{recursive:true,force:true}); }
