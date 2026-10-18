// Build every derived file of this repository in place. Usage: npm run build [-- --check]
// (`npm run build` first regenerates core/src/generated from spec/schema; see package.json.)
//
// Derived files, committed because installs read the git tree:
// - the single-person CLI bundle, from core/src/cli-solo.ts: one copy per plugin, one in the portable
//   skill, and the npm package's bin (the same bytes behind a shebang);
// - the Claude Code plugin's hook runtime (plugins/humans-md/hooks/runtime.mjs), copied into the
//   plugins that install on their own;
// - the compile skill's vocabulary reference, from spec/schema/humans.schema.json;
// - the portable Agent Skills copy skills/humans-md-compile, from the Claude Code plugin's skill;
// - LICENSE and NOTICE in every installable folder, from the root files;
// - the version of every plugin manifest, from packages/humans-md/package.json (npm run release sets it).
// Everything else is a source file: edit it directly.
// --check writes nothing and exits 1 when a committed file differs from what the build would write.
import { build } from "esbuild";
import { existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const root = join(import.meta.dirname, "..");
const args = process.argv.slice(2);
if (args.length > 1 || (args[0] && args[0] !== "--check")) { console.error("usage: node scripts/build.ts [--check]"); process.exit(2); }
const check = args[0] === "--check";
if (!existsSync(join(root, "core/src/generated/validate-profile.js"))) { console.error("build: core/src/generated is missing; run npm run build, which runs npm run gen first"); process.exit(2); }

/** Read a repository file as UTF-8 text. */
const read = (path: string) => readFileSync(join(root, path), "utf8");
const version: string = JSON.parse(read("packages/humans-md/package.json")).version;

/** Every derived file: repository path to exact content. */
const outputs = new Map<string, string>();
/** Folders that hold derived files only: anything else found there is stale. */
const generatedDirs = ["skills/humans-md-compile"];
const emit = (path: string, text: string) => {
  if (outputs.has(path) && outputs.get(path) !== text) throw new Error(`build: two contents for ${path}`);
  outputs.set(path, text);
};

// 1. The CLI bundle.
const built = await build({
  absWorkingDir: root, entryPoints: [join(root, "core/src/cli-solo.ts")], write: false,
  bundle: true, platform: "node", format: "esm", target: "node22", legalComments: "none",
  define: { __HUMANS_MD_VERSION__: JSON.stringify(version) },
  // Statements labelled MULTI_PERSON (group renderings, the recipient hook) are left out: the
  // published CLI reads its owner's profile only.
  dropLabels: ["MULTI_PERSON"],
  banner: { js: '// Bundle of the HUMANS.md single-person CLI, built from core/src by `npm run build`. Do not edit. Apache-2.0; notices in NOTICE.\nimport { createRequire } from "node:module";\nconst require = createRequire(import.meta.url);' },
});
const cli = built.outputFiles[0].text;
// The published CLI must not carry the multi-person code paths: group merging and rendering, the
// recipient hook, audience-based visibility. ("recipient" alone stays: SPEC § 6.3-6.4 owner text.)
// Nor a path from the build machine (a home folder that esbuild or a dependency wrote in).
for (const banned of ["mergeAudience", "--group", "MULTI_PERSON", "humans_group", "claude-recipient", "UserPromptSubmit", "visibleTo", "audience", "/Users/", "/home/"])
  if (cli.includes(banned)) throw new Error(`build: the CLI bundle contains ${banned}`);
// Each plugin installs on its own, so each carries its own copy.
for (const plugin of ["humans-md", "codex", "copilot", "cursor", "devin", "junie", "opencode", "antigravity"]) emit(`plugins/${plugin}/scripts/humans.mjs`, cli);
emit("skills/humans-md-compile/scripts/humans.mjs", cli);
emit("packages/humans-md/bin/humans-md.mjs", "#!/usr/bin/env node\n" + cli);

// 2. The hook runtime of the Claude Code plugin, unchanged, in the plugins that read the same
// envelope. Cursor keeps its own runtime (a source file).
const runtime = read("plugins/humans-md/hooks/runtime.mjs");
for (const path of ["plugins/codex/hooks/runtime.mjs", "plugins/copilot/scripts/runtime.mjs", "plugins/devin/scripts/runtime.mjs", "plugins/opencode/scripts/runtime.mjs", "plugins/junie/hooks/runtime.mjs", "plugins/antigravity/hooks/runtime.mjs"]) emit(path, runtime);

// 3. Licenses. Apache-2.0 for the code, the portable core's license (spec/tools/LICENSE); NOTICE
// carries the CC BY 4.0 spec material and yaml's ISC text (§ 4(d)).
const license = read("LICENSE"), notice = read("NOTICE");
if (license !== read("spec/tools/LICENSE")) throw new Error("build: LICENSE differs from spec/tools/LICENSE, the portable core's license");
const yamlLicense = readFileSync(join(root, "node_modules/yaml/LICENSE"), "utf8").trim().split("\n").map(l => (l ? "  " + l : "")).join("\n");
if (!notice.endsWith(yamlLicense + "\n")) throw new Error("build: NOTICE must end with yaml's LICENSE, indented by two spaces (node_modules/yaml/LICENSE)");
for (const dir of ["plugins/humans-md", "plugins/codex", "plugins/copilot", "plugins/cursor", "plugins/devin", "plugins/junie", "plugins/opencode", "plugins/antigravity", "packages/humans-md", "skills/humans-md-compile"]) {
  emit(`${dir}/LICENSE`, license); emit(`${dir}/NOTICE`, notice);
}

// 4. One version for every package: a plugin's `version` pins installed users until it changes.
for (const path of ["plugins/humans-md/.claude-plugin/plugin.json", "plugins/codex/.codex-plugin/plugin.json", "plugins/copilot/plugin.json", "plugins/cursor/.cursor-plugin/plugin.json", "plugins/devin/.devin-plugin/plugin.json", "plugins/opencode/package.json", "plugins/antigravity/plugin.json"])
  emit(path, JSON.stringify({ ...JSON.parse(read(path)), version }, null, 2) + "\n");

// 5. The closed vocabularies, from the spec's schema, so the compile skill cannot drift from it.
const skill = "plugins/humans-md/skills/compile";
const schema = JSON.parse(read("spec/schema/humans.schema.json"));
/** Format trusted schema enum strings as a comma-separated Markdown code list. */
const list = (values: string[]) => values.map((v) => `\`${v}\``).join(", ");
emit(`${skill}/references/vocabulary.md`, `<!-- Generated from schema/humans.schema.json of https://github.com/cmdai-hq/HUMANS.md. Do not edit. -->
# Vocabularies (spec ${schema.properties.humans.const})

\`context\` takes values from these lists only. A value outside them is rejected by the validator and ignored by consumers.

## \`context.role\` (one)

${list(schema.$defs.role.enum)}

## \`context.knows_well\`, \`context.knows_little\` (topics, at most 15 each)

${list(schema.$defs.topic.enum)}

## \`context.decides\` (at most 10)

${list(schema.$defs.decision.enum)}

## \`languages\`

ISO 639-1 codes (${schema.$defs.language.enum.length} accepted), e.g. \`fr\`, \`en\`, \`de\`.

## \`interrupting.quiet_hours.time_zone\` (one)

${schema.$defs.timeZone.enum.length} pinned names. ${schema.$defs.timeZone.description} Any other name is invalid; never substitute a nearby city.

${list(schema.$defs.timeZone.enum)}

## \`interrupting.quiet_hours.all_day\`

${list(schema.$defs.interrupting.properties.quiet_hours.properties.all_day.items.enum)}
`);
// The plugin's skill calls the plugin's copy (${CLAUDE_PLUGIN_ROOT}/scripts/humans.mjs): no second bundle.
if (existsSync(join(root, skill, "scripts"))) throw new Error(`build: ${skill}/scripts must not exist; the skill uses the plugin's scripts/humans.mjs`);

// 6. The portable skill.
portableSkill();

/**
 * The portable Agent Skills copy at skills/humans-md-compile, for `npx skills add` and any client
 * that reads the open format: the plugin's skill, renamed, with its own copy of the CLI and license
 * files. Agents run commands from the user's project, where a file named scripts/humans.mjs may be
 * the project's own: the skill names the CLI by the absolute skill directory its client announces,
 * or else the pinned npm package with npm's project set to an empty temporary folder
 * (`npx --prefix`: no package.json, node_modules or .npmrc from the user's project), never by a
 * relative path.
 * The plugin's copy, which names ${CLAUDE_PLUGIN_ROOT}, stays hidden from `npx skills add` listings
 * (metadata.internal: true): that tool also lists every skill under a Claude plugin's skills/ folder.
 */
function portableSkill() {
  const dir = "skills/humans-md-compile";
  const references = readdirSync(join(root, skill, "references")).sort();
  for (const file of references) emit(`${dir}/references/${file}`, outputs.get(`${skill}/references/${file}`) ?? read(`${skill}/references/${file}`));
  const npx = `npx --prefix "<temp-dir>" -y @humans-md/cli@${version}`;
  const findCli = `## Find the CLI

Steps 3 and 4 run the HUMANS.md command line (CLI), written \`<humans-md>\` below. This skill ships it as \`scripts/humans.mjs\` in its own folder. Agents run commands from the user's project, and a project can ship its own \`scripts/humans.mjs\`: never run that path relative to the current directory, and never run a copy found in the project. Before step 3, choose \`<humans-md>\` once, in this order:

1. Claude Code fills in this skill's folder here: \`\${CLAUDE_SKILL_DIR}\`. If that shows an absolute path, \`<humans-md>\` is \`node "<that path>/scripts/humans.mjs"\`. If it still shows a dollar sign and braces, your client did not fill it in: never pass that text to a shell.
2. Otherwise, use the absolute folder your client gave for this skill: its location in the skill list (Codex, Gemini CLI, GitHub Copilot), the "Base directory for this skill" line (OpenCode), or the path you read this SKILL.md from. Take the folder that contains this SKILL.md, and turn a \`file://\` URL into a path. \`<humans-md>\` is \`node "<that folder>/scripts/humans.mjs"\`.
3. If you know no absolute path, first make \`<temp-dir>\`, the folder step 3 writes its draft to, with \`mktemp -d\`: a new, empty folder outside the project. Then \`<humans-md>\` is \`${npx}\`. With \`--prefix\`, npm takes that folder as the project, so the user's project cannot answer with its own \`node_modules\`, \`package.json\` or \`.npmrc\`. Tell the user it downloads the published CLI from npm.

Then run \`<humans-md> --version\`. It must print \`${version}\`; otherwise stop and tell the user.

Done when: \`<humans-md>\` is this skill's own \`scripts/humans.mjs\` by absolute path, or the pinned npm package, and it printed \`${version}\`.

`;
  emit(`${dir}/SKILL.md`, adapt(`${skill}/SKILL.md`, read(`${skill}/SKILL.md`), [
    ["\nname: compile\n", "\nname: humans-md-compile\n", 1],
    ["\nmetadata:\n  internal: true\n", "\nmetadata:\n", 1],
    ["compatibility: Needs Node 22.18+ for the plugin's scripts/humans.mjs and authorized local write access.",
      "compatibility: Needs Node 22.18+ for this skill's scripts/humans.mjs (or npx) and authorized local write access to ~/.humans.", 1],
    ['`node "${CLAUDE_PLUGIN_ROOT}/scripts/humans.mjs" ', "`<humans-md> ", 2],
    ["With this plugin, only your own agents load the profile", "With HUMANS.md plugins and hooks, only your own agents load the profile", 1],
    ["intended recipients (with this plugin, only your own agents)", "intended recipients (with HUMANS.md plugins and hooks, only your own agents)", 1],
    [", or to the file set as Your HUMANS.md in this plugin's settings (it must be named `HUMANS.md`), never inside a repository", ", never inside a repository", 1],
    ["With this plugin, it loads at the next session start; ",
      "To load it at each session start, the user installs the HUMANS.md plugin or hook for their client (https://github.com/cmdai-hq/humans-md-plugins); ", 1],
    ["\n## 3. Validate and preview\n", `\n${findCli}## 3. Validate and preview\n`, 1],
    // Clients without a hook (Cline, Warp Agent CLI, Junie CLI) read a copy that sync writes: it
    // must be rerun. The Warp app keeps a pasted Global Rule instead.
    ["Updating/deleting a profile takes effect on the next render; an already loaded session must be refreshed. No derived-file cache is supplied.",
      "With a plugin or hook, updating/deleting a profile takes effect on the next render; an already loaded session must be refreshed. Clients without a hook (Cline, the Warp Agent CLI, the Junie CLI) read a copy made by `<humans-md> sync` (`--to junie` for Junie): after saving, tell the user to run the same command again; after deleting the profile, to run the same command with `--remove` added (`<humans-md> sync --to junie --remove` for Junie). The Warp app reads no file: the user pastes the output of `<humans-md> show` into a Global Rule again, or removes that rule.", 1],
  ]));
}

/** Replace each passage exactly as often as stated, or stop the build: the source changed under it. */
function adapt(path: string, text: string, edits: [string, string, number][]) {
  for (const [from, to, count] of edits) {
    if (text.split(from).length - 1 !== count) throw new Error(`build: ${path}: expected ${count}× ${JSON.stringify(from.slice(0, 50))}; update scripts/build.ts`);
    text = text.split(from).join(to);
  }
  return text;
}

/** List files under a repository folder, relative to the repository. */
const files = (dir: string): string[] => existsSync(join(root, dir))
  ? readdirSync(join(root, dir), { recursive: true, encoding: "utf8" }).map(p => join(dir, p)).filter(p => !lstatSync(join(root, p)).isDirectory())
  : [];
const stale = generatedDirs.flatMap(files).filter(p => !outputs.has(p));
/** A derived file is up to date when it is a regular file with the same bytes, not executable. */
const current = (path: string) => {
  const abs = join(root, path);
  if (!existsSync(abs)) return false;
  const st = lstatSync(abs);
  return st.isFile() && (st.mode & 0o111) === 0 && readFileSync(abs, "utf8") === outputs.get(path);
};
const drift = [...outputs.keys()].filter(p => !current(p)).concat(stale).sort();
if (check) {
  if (drift.length) { console.error(`build: ${drift.length} derived file(s) differ from the sources; run npm run build and commit:\n  ${drift.join("\n  ")}`); process.exit(1); }
  console.log(`build: ${outputs.size} derived files up to date (humans-md ${version})`);
} else {
  for (const path of drift) {
    const abs = join(root, path);
    if (!outputs.has(path)) { rmSync(abs, { force: true }); continue; }
    rmSync(abs, { force: true });
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, outputs.get(path)!);
  }
  console.log(`build: ${drift.length ? `wrote ${drift.join(", ")}` : "nothing to write"} (${outputs.size} derived files, humans-md ${version})`);
}
