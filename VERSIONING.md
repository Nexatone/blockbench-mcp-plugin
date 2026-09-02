# Versioning and release guidance

## Source of truth

Edit only `package.json` to change the plugin version. `lib/constants.ts` exports
that value as `VERSION`; Blockbench registration and the MCP server use it. The
build banner, prompt manifest and API documentation also derive it from the
package. Do not maintain separate runtime version literals.

Josshy's version line starts at **1.0.0**, deliberately reset from the inherited
**1.6.1** number at the maintainer's request. This renumbers the existing fixed
plugin; it does not revert its features or remove original credit/history.
Future changes advance from this baseline, never from the old upstream number.
Historical test reports retain the version they actually tested.

## Decide the version for every PR

Follow [Semantic Versioning](https://semver.org/). The compatibility surface here
includes MCP tool/resource/prompt names, schemas, defaults and results; connection
configuration; Blockbench settings; and saved/exported data behavior.

| Change | Required action | Example from 1.0.0 |
| --- | --- | --- |
| Compatible bug, reliability or security fix; internal runtime change | Patch bump | 1.0.1 |
| Compatible new tool, optional capability or deprecation | Minor bump | 1.1.0 |
| Removed/renamed API, newly required input, incompatible result, changed supported workflow or data contract | Major bump and migration notes | 2.0.0 |
| Documentation, tests, agent guidance or CI only, without changing plugin behavior | No plugin bump; state why in the PR | 1.0.0 |

Bundled prompt changes and dependency/build changes that affect the shipped
plugin count as plugin changes. A rebuild or generated timestamp alone does not.
Choose the highest impact in the complete PR; a small diff can still break a
client. Document an intentional bug correction that changes previously observed
behavior so reviewers can judge its compatibility impact.

Use one target version per PR. Follow-up review fixes stay under that version
until merged; increase its impact if the PR's scope grows. Before publishing or
merging, compare with the current base branch's package version. If another PR
has already used the planned version, choose the next appropriate one and
regenerate the files. Do not rewrite an already published version or changelog
entry to describe new plugin behavior. An explicit maintainer version request
takes precedence; record exceptional resets as such.

## Update sequence

1. Inspect Git state and the current base version. State the old/new version and
   impact, or the reason the change needs no bump.
2. Edit `package.json`. Add the matching newest section to `CHANGELOG.md`, using
   `Added`, `Changed`, `Fixed` and `Compatibility` headings only where useful.
   Describe user effects and migration needs, not every implementation detail.
   Use an Unreleased heading for a prepared version; add a publication date only
   when that deployment/release is confirmed. Do not invent past release dates.
3. Run these one-shot commands:

   ```sh
   bun install --frozen-lockfile
   bun run build
   bun run docs:build
   bun run test
   bun run typecheck
   ```

   `build` regenerates `prompts/manifest.json` before bundling. For a development
   artifact with a source map, run `bun run dev` afterward. If dependencies
   change, intentionally update `bun.lock` before the frozen install; a plugin
   version-only edit does not require a lockfile dependency update.
4. Verify that `package.json`, `prompts/manifest.json`, `docs/api.json`, the
   displayed API version in `docs/index.html`, and the opening version banner in
   `dist/mcp.js` agree. The runtime continues to import `VERSION`.
5. Include the package, changelog and regenerated tracked assets in the PR. Keep
   `dist/` and `.verification/` untracked. Report test/build/typecheck results and
   any live checks, including whether the running plugin is the intended build.

For no-bump changes, avoid committing generated timestamp-only noise. Maintainers
and agents use the same process; builds never silently increment the version.

## Deployment and user updates

PRs run tests and builds. A merged `main` build deploys to the existing Pages site:
`https://itsjosshy.github.io/blockbench-mcp-plugin/nightly/mcp.js`.
The path remains `nightly` regardless of the package version. A version edit is
not a GitHub release, tag, merge, or publication authorization. The workflow does
not create release tags or release artifacts automatically.

After Pages publication, use **File → Plugins → Installed → MCP Server → Reload**
for a URL installation, then reconnect the MCP client. A file installation needs
the newly built `dist/mcp.js` and a reload. Confirm the new version in Blockbench;
MCP initialization should report the same version. For the initial reset from
1.6.1 to 1.0.0, explicitly reload the URL instead of relying on a higher-version
update notification.
