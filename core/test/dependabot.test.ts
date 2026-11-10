import { it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { parse } from 'yaml';

const root = join(import.meta.dirname, '../..');
const json = (path: string) => JSON.parse(readFileSync(join(root, path), 'utf8'));

it('Dependabot watches every npm manifest that declares dependencies', () => {
  const config = parse(readFileSync(join(root, '.github/dependabot.yml'), 'utf8'));
  const watched: string[] = config.updates.filter((u: any) => u['package-ecosystem'] === 'npm').map((u: any) => u.directory);
  // spec/ is a pinned mirror of cmdai-hq/HUMANS.md, verified by hash: its manifest changes there.
  const manifests = (dir: string): string[] => readdirSync(join(root, dir), { withFileTypes: true }).flatMap(entry => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return ['node_modules', '.git', 'spec'].includes(entry.name) ? [] : manifests(path);
    return entry.name === 'package.json' ? [path] : [];
  });
  const declaring = manifests('').filter(path =>
    ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies'].some(kind => Object.keys(json(path)[kind] ?? {}).length));
  // The root manifest pins `yaml`, which the build bundles into the published command line.
  expect(json('package.json').devDependencies.yaml).toMatch(/^\d+\.\d+\.\d+$/);
  expect(declaring).toContain('package.json');
  for (const path of declaring) expect(watched, path).toContain(join('/', dirname(path)));
  // GitHub Actions stay watched.
  expect(config.updates.map((u: any) => u['package-ecosystem'])).toContain('github-actions');
});
