import { it, expect } from 'vitest';
import { cpSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
it('checks content drift, unpinned revisions and private REQUESTS exemption', () => {
  const dir = mkdtempSync(join(tmpdir(),'humans-mirror-'));
  try {
    mkdirSync(join(dir,'scripts'),{recursive:true});
    const script = join(dir,'scripts/sync-spec.mjs');
    cpSync(join(import.meta.dirname,'../../scripts/sync-spec.mjs'),script);
    cpSync(join(import.meta.dirname,'../../spec'),join(dir,'spec'),{recursive:true,
      /**
       * Copy the fixture mirror without dependency trees or private requests, which the test recreates
       * independently.
       */
      filter:p => !p.includes('/node_modules') && !p.endsWith('/REQUESTS.md')});
    /**
     * Run only check mode against the temporary mirror and capture failure codes without modifying the
     * pinned source mirror.
     */
    const run = (...args: string[]) => spawnSync(process.execPath,[script,'--check',...args],{encoding:'utf8'});
    writeFileSync(join(dir,'spec/REQUESTS.md'),'Private synthetic request.\n');
    expect(run().status).toBe(0);
    expect(run('--revision','0000000000000000000000000000000000000000').status).toBe(1);
    writeFileSync(join(dir,'spec/SPEC.md'),'Drift.\n');
    const drift = run(); expect(drift.status).toBe(1); expect(drift.stderr).toBe('MIRROR_DRIFT\n');
  } finally { rmSync(dir,{recursive:true,force:true}); }
});
