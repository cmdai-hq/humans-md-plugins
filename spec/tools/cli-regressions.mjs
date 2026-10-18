// Shared subprocess assertions for reference and bundled CLI entrances.
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
/**
 * Assert exit 2, empty stdout and the fixed diagnostic for the listed unsupported CLI flags.
 * For before/after flag cases, watch selected filesystem methods on the fixture path and assert no access;
 * remove the temporary fixtures afterward.
 */
export function assertRejectedArguments(cli, commands) {
  const dir = mkdtempSync(join(tmpdir(),'humans-args-'));
  try {
    const target = join(dir,'HUMANS.md'), trace = join(dir,'io'), preload = join(dir,'preload.mjs');
    writeFileSync(target,'PAYLOAD_MUST_NOT_BE_READ');
    writeFileSync(preload, `import fs from 'node:fs';\nimport { syncBuiltinESMExports } from 'node:module';\nfor (const method of ['openSync','readFileSync','realpathSync']) { const original = fs[method]; fs[method] = function(path,...args) { if (path === ${JSON.stringify(target)}) { fs.writeFileSync(${JSON.stringify(trace)},method); throw Error('UNEXPECTED_FILE_IO'); } return original.call(this,path,...args); }; if (original.native) fs[method].native = function(path,...args) { if (path === ${JSON.stringify(target)}) { fs.writeFileSync(${JSON.stringify(trace)},method+'.native'); throw Error('UNEXPECTED_FILE_IO'); } return original.native.call(this,path,...args); }; }\nsyncBuiltinESMExports();\n`);
    const flags = ['--state','--state=','--state=incident','--activeStates','--activeStates=','--activeStates=[]','--activeStates=incident','--unknown','--draft=true','-x','-state','--'];
    for (const flag of flags) for (const position of ['before','after']) {
      const args = position === 'before' ? [flag,target] : [target,flag];
      const r = spawnSync(process.execPath,['--import',preload,cli instanceof URL ? fileURLToPath(cli) : cli,...commands,...args],{encoding:'utf8',timeout:5000});
      assert.equal(r.status,2,`${commands} ${flag} ${position}: ${r.stderr}`);
      assert.equal(r.stdout,''); assert.equal(r.stderr,'UNSUPPORTED_ARGUMENT\n');
      assert.equal(existsSync(trace),false,`${flag}: file IO preceded rejection`);
    }
    for (const flag of ['--state','--activeStates']) {
      const r = spawnSync(process.execPath,[cli instanceof URL ? fileURLToPath(cli) : cli,...commands,flag,'incident',target],{encoding:'utf8',timeout:5000});
      assert.equal(r.status,2); assert.equal(r.stdout,''); assert.equal(r.stderr,'UNSUPPORTED_ARGUMENT\n');
    }
  } finally { rmSync(dir,{recursive:true,force:true}); }
}
