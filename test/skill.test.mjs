// Model-free checks of the two compile skills, as shipped: the portable one (skills/humans-md-compile,
// for `npx skills add` and any Agent Skills client) and the Claude Code plugin's (/humans-md:compile).
// Run: node --test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';

const root = join(import.meta.dirname, '..');
const portable = join(root, 'skills/humans-md-compile');
const plugin = join(root, 'plugins/humans-md/skills/compile');
const version = JSON.parse(readFileSync(join(root, 'packages/humans-md/package.json'), 'utf8')).version;
const read = path => readFileSync(path, 'utf8');
/** The npm fallback command of the portable skill, as written in SKILL.md. */
const npxCommand = text => {
  const found = [...text.matchAll(/`(npx [^`\n]+)`/g)].map(m => m[1]);
  assert.equal(new Set(found).size, 1, found.join(' | '));
  return found[0];
};

/**
 * Parse the frontmatter shapes these skills use: `key: value`, `key: >-` folded blocks and one level
 * of `metadata:` mapping. Anything else fails, so a new shape needs a test change first.
 */
function frontmatter(text) {
  const match = /^---\n([\s\S]*?)\n---\n/.exec(text);
  assert.ok(match, 'SKILL.md starts with YAML frontmatter');
  const data = {}, lines = match[1].split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const top = /^([a-z-]+):(?: (.*))?$/.exec(line);
    assert.ok(top, `frontmatter line ${JSON.stringify(line)}`);
    const [, key, value] = top;
    assert.ok(!(key in data), `duplicate key ${key}`);
    if (value === '>-') {
      const block = [];
      while (lines[i + 1]?.startsWith('  ')) block.push(lines[++i].trim());
      data[key] = block.join(' ');
    } else if (value === undefined) {
      data[key] = {};
      while (lines[i + 1]?.startsWith('  ')) {
        const [, k, v] = /^ {2}([a-z_-]+): (.+)$/.exec(lines[++i]) ?? assert.fail(`nested line ${lines[i]}`);
        data[key][k] = /^(true|false|null|~|-?\d+(\.\d+)?)$/.test(v) ? JSON.parse(v === '~' ? 'null' : v) : v;
      }
    } else data[key] = value;
  }
  return { data, body: text.slice(match[0].length) };
}

// https://agentskills.io/specification (read 2026-10-17): fields, `name` and `description` rules,
// `compatibility` length, `metadata` as a string-to-string map, under 500 lines and about 5000 tokens.
const FIELDS = ['name', 'description', 'license', 'compatibility', 'metadata', 'allowed-tools'];
function assertSpec(dir) {
  const text = read(join(dir, 'SKILL.md'));
  const { data } = frontmatter(text);
  for (const key of Object.keys(data)) assert.ok(FIELDS.includes(key), `${basename(dir)}: field ${key} is not in the spec`);
  assert.equal(typeof data.name, 'string');
  assert.ok(data.name.length >= 1 && data.name.length <= 64, 'name length');
  assert.match(data.name, /^[a-z0-9]+(-[a-z0-9]+)*$/, 'lowercase letters, digits, single inner hyphens');
  assert.equal(data.name, basename(dir), 'name matches the folder');
  assert.ok(data.description.length >= 1 && data.description.length <= 1024, 'description length');
  if ('compatibility' in data) assert.ok(data.compatibility.length >= 1 && data.compatibility.length <= 500, 'compatibility length');
  assert.ok(text.split('\n').length < 500, 'under 500 lines');
  // About four characters per English token; three per token keeps the estimate on the safe side.
  assert.ok(Buffer.byteLength(text) / 3 <= 5000, `about ${Math.ceil(Buffer.byteLength(text) / 3)} tokens, over 5000`);
  // Relative links resolve inside the skill, one level deep.
  for (const [, target] of text.matchAll(/\]\(([^)#]+)(#[^)]*)?\)/g)) {
    if (/^https?:/.test(target)) continue;
    assert.match(target, /^references\/[a-z-]+\.md$/, `link ${target}`);
    assert.ok(existsSync(join(dir, target)), `link ${target} exists`);
  }
  return data;
}

test('the portable skill follows the Agent Skills specification', () => {
  const data = assertSpec(portable);
  assert.equal(data.name, 'humans-md-compile');
  assert.equal(data.license, 'Apache-2.0');
  for (const [key, value] of Object.entries(data.metadata ?? {})) assert.equal(typeof value, 'string', `metadata.${key} is a string`);
  for (const file of ['LICENSE', 'NOTICE']) assert.equal(read(join(portable, file)), read(join(root, file)), file);
});

test('the portable skill never runs the CLI by a path relative to the working directory', () => {
  const text = read(join(portable, 'SKILL.md'));
  const docs = [text, ...readdirSync(join(portable, 'references')).map(f => read(join(portable, 'references', f)))].join('\n');
  // Every command span that runs something names the CLI by an absolute placeholder, <humans-md> or
  // the pinned npm package; a bare scripts/humans.mjs would run the project's own file.
  const spans = [...docs.matchAll(/`([^`\n]+)`/g)].map(m => m[1]);
  const commands = spans.filter(s => /^(node|npx|cd|mktemp) |^\.\/|humans\.mjs\s|^<humans-md> /.test(s));
  // The bare name is only ever mentioned, never run: as the file this skill ships, in its own folder.
  for (const span of spans.filter(s => /scripts\/humans\.mjs/.test(s) && !commands.includes(s))) assert.equal(span, 'scripts/humans.mjs');
  assert.ok(commands.length >= 5, commands.join(' | '));
  for (const span of commands) {
    assert.match(span, /^(node "<that (path|folder)>\/scripts\/humans\.mjs"|<humans-md> (check|show|--version)\b|npx --prefix "<temp-dir>" -y @humans-md\/cli@[^ ]+$|mktemp -d$)/, span);
  }
  assert.doesNotMatch(docs, /node (\.\/)?scripts\/|node "(\.\/)?scripts\/|CLAUDE_PLUGIN_ROOT|this plugin/);
  // The npm fallback is pinned to this release, with npm's project set to a new folder from mktemp.
  for (const [, pinned] of docs.matchAll(/@humans-md\/cli@([^ `]+)/g)) assert.equal(pinned, version);
  assert.equal(npxCommand(text), `npx --prefix "<temp-dir>" -y @humans-md/cli@${version}`);
  assert.match(text, /make `<temp-dir>`, the folder step 3 writes its draft to, with `mktemp -d`/);
  assert.match(text, new RegExp(`It must print \`${version.replaceAll('.', '\\.')}\``));
  // Claude Code replaces every occurrence of the variable: once, or the sentence around it breaks.
  assert.equal(text.split('${CLAUDE_SKILL_DIR}').length - 1, 1);
  assert.match(text, /never run that path relative to the current directory, and never run a copy found in the project/);
  // Found before the first command runs.
  assert.ok(text.indexOf('## Find the CLI') < text.indexOf('<humans-md> check'));
  assert.ok(text.indexOf('## 2.') < text.indexOf('## Find the CLI'));
});

// npm reads package.json, node_modules and .npmrc from the project around the working directory;
// agents run commands from the user's project. Offline with an empty cache, the fallback must fail
// rather than run a copy the project planted or read the project's npm settings.
const hasNpx = process.platform !== 'win32' && spawnSync('npx', ['--version'], { encoding: 'utf8', timeout: 10_000 }).status === 0;
test('the npm fallback ignores the project: no planted copy, no project .npmrc', { skip: !hasNpx && 'npx not available' }, () => {
  const dir = realpathSync.native(mkdtempSync(join(tmpdir(), 'humans-md-npx-')));
  try {
    const project = join(dir, 'project'), pkg = join(project, 'node_modules/@humans-md/cli');
    mkdirSync(join(pkg, 'bin'), { recursive: true });
    mkdirSync(join(project, 'node_modules/.bin'));
    writeFileSync(join(project, 'package.json'), JSON.stringify({ name: 'planted', version: '1.0.0', dependencies: { '@humans-md/cli': version } }));
    writeFileSync(join(pkg, 'package.json'), JSON.stringify({ name: '@humans-md/cli', version, bin: { 'humans-md': 'bin/humans-md.mjs' } }));
    writeFileSync(join(pkg, 'bin/humans-md.mjs'), "#!/usr/bin/env node\nconsole.log('PLANTED');\n", { mode: 0o755 });
    symlinkSync('../@humans-md/cli/bin/humans-md.mjs', join(project, 'node_modules/.bin/humans-md'));
    // Project settings npm must not read: another registry and another cache.
    writeFileSync(join(project, '.npmrc'), `registry=http://127.0.0.1:9/planted/\ncache=${join(dir, 'planted-cache')}\n`);
    // The user's settings for this test: offline, with an empty cache of its own.
    writeFileSync(join(dir, 'userrc'), `cache=${join(dir, 'cache')}\noffline=true\nupdate-notifier=false\naudit=false\nfund=false\n`);
    const temp = mkdtempSync(join(dir, 'tmp-'));
    const command = npxCommand(read(join(portable, 'SKILL.md'))).replace('<temp-dir>', temp);
    const out = spawnSync('/bin/sh', ['-c', command + ' --version'], {
      cwd: project, encoding: 'utf8', timeout: 60_000,
      env: { PATH: process.env.PATH, HOME: dir, npm_config_userconfig: join(dir, 'userrc') },
    });
    assert.doesNotMatch(out.stdout + out.stderr, /PLANTED|planted/, 'the project copy or its .npmrc was used');
    assert.ok(!existsSync(join(dir, 'planted-cache')), 'the project .npmrc was read');
    // Nothing cached, no network: npm can only fail.
    assert.notEqual(out.status, 0);
    assert.match(out.stderr, /ENOTCACHED/);
    assert.deepEqual(readdirSync(temp), [], 'npx leaves the draft folder empty');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('the portable skill keeps disclosure, preview, approval and the canonical location', () => {
  const text = read(join(portable, 'SKILL.md'));
  assert.match(text, /or asking the first interview question, state which assistant\/provider will process it/);
  assert.match(text, /\[interview\]\(references\/interview\.md\)/);
  assert.match(text, /<humans-md> show <temp-dir>\/HUMANS\.md` only within the owner's explicit local compilation preview/);
  assert.match(text, /Done when: the draft validates and the owner approves the exact fields, notes and sharing scope shown\./);
  assert.match(text, /Write the approved frontmatter to the canonical `~\/\.humans\/HUMANS\.md`, never inside a repository,/);
  assert.match(text, /https:\/\/github\.com\/cmdai-hq\/humans-md-plugins/);
});

test('the portable skill carries the published CLI, byte for byte', () => {
  const copy = join(portable, 'scripts/humans.mjs');
  assert.ok(read(copy) === read(join(root, 'plugins/humans-md/scripts/humans.mjs')), 'same bundle as the plugins');
  assert.equal('#!/usr/bin/env node\n' + read(copy), read(join(root, 'packages/humans-md/bin/humans-md.mjs')));
  assert.deepEqual(readdirSync(join(portable, 'scripts')), ['humans.mjs']);
  const out = spawnSync(process.execPath, [copy, '--version'], { encoding: 'utf8', timeout: 10_000, cwd: join(root, 'test') });
  assert.equal(out.status, 0);
  assert.equal(out.stdout.trim(), version);
});

test('the Claude Code plugin skill is still generated as before, and hidden from npx skills', () => {
  const text = read(join(plugin, 'SKILL.md'));
  const { data } = frontmatter(text);
  assertSpec(plugin);
  assert.equal(data.name, 'compile');
  assert.equal(text.split('`node "${CLAUDE_PLUGIN_ROOT}/scripts/humans.mjs" ').length - 1, 2);
  assert.doesNotMatch(text, /<humans-md>|## Find the CLI|CLAUDE_SKILL_DIR/);
  assert.ok(!existsSync(join(plugin, 'scripts')), 'the plugin skill uses the plugin\'s own CLI copy');
  // `npx skills add` skips a skill whose metadata.internal is the boolean true (vercel-labs/skills
  // src/skills.ts); it would otherwise list the plugin's copy, which only works inside the plugin.
  assert.equal(data.metadata.internal, true);
  // One body, two packagings: the same references and the same steps.
  for (const file of readdirSync(join(plugin, 'references'))) assert.equal(read(join(portable, 'references', file)), read(join(plugin, 'references', file)), file);
  assert.deepEqual(readdirSync(join(portable, 'references')).sort(), readdirSync(join(plugin, 'references')).sort());
  const headings = t => t.split('\n').filter(l => l.startsWith('## '));
  assert.deepEqual(headings(read(join(portable, 'SKILL.md'))).filter(h => h !== '## Find the CLI'), headings(text));
  const step2 = t => t.slice(t.indexOf('## 2.'), t.indexOf('\n## ', t.indexOf('## 2.') + 1));
  assert.equal(step2(read(join(portable, 'SKILL.md'))), step2(text));
});

test('npx skills add lists exactly one skill: humans-md-compile', () => {
  // vercel-labs/skills discovery: skills/<name>/SKILL.md, plus <plugin>/skills/* for every local
  // plugin of .claude-plugin/marketplace.json; metadata.internal: true hides a skill.
  const market = JSON.parse(read(join(root, '.claude-plugin/marketplace.json')));
  const containers = [join(root, 'skills'), ...market.plugins.map(p => join(root, p.source, 'skills'))];
  const listed = containers.filter(existsSync).flatMap(dir => readdirSync(dir).map(name => join(dir, name)))
    .filter(dir => existsSync(join(dir, 'SKILL.md')))
    .map(dir => frontmatter(read(join(dir, 'SKILL.md'))).data)
    .filter(data => data.metadata?.internal !== true).map(data => data.name);
  assert.deepEqual(listed, ['humans-md-compile']);
});
