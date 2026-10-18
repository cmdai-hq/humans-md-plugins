// Bundles the reference CLI (src/cli.ts: validate, serve, merge, render-agent) into a temporary file
// for the tests that run it as a child process. It is never published: the published CLI is
// src/cli-solo.ts, bundled by scripts/build.ts.
import { build } from "esbuild";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { TestProject } from "vitest/node";

declare module "vitest" {
  export interface ProvidedContext { referenceCli: string }
}

export default async function setup(project: TestProject) {
  const root = join(import.meta.dirname, "../../..");
  const dir = mkdtempSync(join(tmpdir(), "humans-reference-cli-"));
  const outfile = join(dir, "humans.mjs");
  await build({
    absWorkingDir: root, entryPoints: [join(root, "core/src/cli.ts")], outfile,
    bundle: true, platform: "node", format: "esm", target: "node22", legalComments: "none", logLevel: "error",
    banner: { js: 'import { createRequire } from "node:module";\nconst require = createRequire(import.meta.url);' },
  });
  project.provide("referenceCli", outfile);
  return () => rmSync(dir, { recursive: true, force: true });
}
