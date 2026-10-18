// Set or verify the one version of every package. See docs/RELEASING.md.
//   npm run release 0.3.2              set it, then rebuild (npm run build writes it everywhere)
//   npm run release -- --verify 0.3.2  exit 1 unless every version field and the CLI say 0.3.2
// packages/humans-md/package.json holds the version; scripts/build.ts copies it into every plugin
// manifest, the CLI bundle (--version) and the portable skill's pinned npx command.
import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..');
const args = process.argv.slice(2);
const verify = args[0] === '--verify';
const version = verify ? args[1] : args[0];
if (args.length !== (verify ? 2 : 1) || !/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(-[0-9A-Za-z.-]+)?$/.test(version ?? '')) {
  console.error('usage: npm run release <x.y.z> | npm run release -- --verify <x.y.z>');
  process.exit(2);
}
const pkgPath = join(root, 'packages/humans-md/package.json');
const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));

if (verify) {
  const problems = [];
  if (pkg.version !== version) problems.push(`packages/humans-md/package.json is ${pkg.version}`);
  // The derived fields (plugin manifests, bundle, skill pin) must match the package: build --check.
  const build = spawnSync('npm', ['run', 'build', '--', '--check'], { cwd: root, encoding: 'utf8' });
  if (build.status !== 0) problems.push(`npm run build -- --check failed:\n${build.stderr.trim()}`);
  const cli = spawnSync(process.execPath, [join(root, 'packages/humans-md/bin/humans-md.mjs'), '--version'], { encoding: 'utf8' });
  if (cli.stdout.trim() !== version) problems.push(`humans-md --version prints ${cli.stdout.trim() || cli.stderr.trim()}`);
  if (problems.length) { console.error(`release: not ${version}:\n- ${problems.join('\n- ')}`); process.exit(1); }
  console.log(`release: every version field is ${version}`);
} else {
  if (pkg.version === version) console.log(`release: already ${version}; rebuilding`);
  writeFileSync(pkgPath, JSON.stringify({ ...pkg, version }, null, 2) + '\n');
  execFileSync('npm', ['run', 'build'], { cwd: root, stdio: 'inherit' });
  console.log(`release: ${version} set. Next: update the README's tested versions if needed, open a PR, merge, then git tag v${version} && git push origin v${version}`);
}
