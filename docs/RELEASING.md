# Releasing

One version covers everything: the npm package `@humans-md/cli`, every plugin manifest, the CLI's `--version` and the portable skill's pinned `npx` command. `packages/humans-md/package.json` holds it, and `npm run build` copies it everywhere else.

## One-time setup

1. **npm trusted publisher.** On npmjs.com, open `@humans-md/cli` → Settings → Trusted publishing, and add a GitHub Actions publisher: organization `cmdai-hq`, repository `humans-md-plugins`, workflow `release.yml`, environment `npm`. The workflow then publishes with OIDC: no `NPM_TOKEN` secret, and provenance is attached. If a trusted publisher already points at this repository, workflow `release.yml` and environment `npm`, nothing changes: only the tag pattern changed, from `cli-v*` to `v*`.
2. **Staged publishing.** The workflow runs `npm stage publish`: the version waits on npmjs.com until a maintainer approves it with 2FA. Keep staged publishing allowed for the package.
3. **GitHub environment `npm`.** It must exist (Settings → Environments). Restrict it to tags `v*`, and add required reviewers if a second approval is wanted.
4. **Spec sync pull requests.** For `.github/workflows/spec-sync.yml`, allow GitHub Actions to create pull requests: Settings → Actions → General → Workflow permissions → "Allow GitHub Actions to create and approve pull requests".

## Release steps

1. On a branch from `main`: `npm run release 0.3.2`. It sets the version and runs `npm run build`.
2. Update the README if needed (Compatibility: what was tested on which version), then `npm test`.
3. Open a pull request, wait for CI, merge.
4. Tag the merge commit on `main`: `git checkout main && git pull && git tag v0.3.2 && git push origin v0.3.2`.
5. The `release` workflow checks that the tag equals every version field (`node scripts/release.mjs --verify 0.3.2`), runs `npm run build -- --check`, the typecheck and every test, stages the package on npm, then creates the GitHub release with generated notes.
6. Approve the staged version on npmjs.com with 2FA. Then check: `npx -y @humans-md/cli@0.3.2 --version`.

Plugin users get the new version from this repository's `main` as soon as step 3 merges: the plugins read the git tree, not npm. Merge the release pull request only when the npm release can follow.

## If the workflow fails

- **Tag and versions differ:** delete the tag (`git push origin :refs/tags/v0.3.2`, `git tag -d v0.3.2`), fix the version on `main` with a pull request, tag again.
- **After staging:** reject the staged version on npmjs.com if it is wrong. An approved version cannot be published again under the same number: release the next patch.
