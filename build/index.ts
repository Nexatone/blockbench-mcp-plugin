import { watch } from "node:fs";
import { mkdir, copyFile, rename, rm, stat } from "node:fs/promises";
import { resolve, join, normalize, sep } from "node:path";
import { log, c, isCleanMode, isProduction, isWatchMode } from "./utils";
import { blockbenchCompatPlugin, textFileLoaderPlugin } from "./plugins";
import { version } from "../package.json";
import { generatePromptManifest } from "./generate-manifest";

const OUTPUT_DIR = "./dist";
// Normalized output dir name for path comparison (strips "./" prefix)
const OUTPUT_DIR_NAME = normalize(OUTPUT_DIR).replace(/^\.[\\/]/, "");
const entryFile = resolve("./index.ts");

async function renameOutput(source: string, target: string): Promise<void> {
  // Windows can briefly lock a bundle while the editor or a verifier reads it.
  for (let attempt = 0; ; attempt++) {
    try { await rename(source, target); return; }
    catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (process.platform !== "win32" || !["EPERM", "EBUSY", "EACCES"].includes(code ?? "") || attempt >= 8) throw error;
      await new Promise(resolve => setTimeout(resolve, 25 * (attempt + 1)));
    }
  }
}

async function cleanOutputDir() {
  try {
    const info = await stat(OUTPUT_DIR);
    if (info.isDirectory()) {
      log.header("[Build] Clean");
      log.step(`Cleaning output directory: ${c.cyan}${OUTPUT_DIR}${c.reset}`);
      await rm(OUTPUT_DIR, { recursive: true, force: true });
    }
  } catch {
    log.dim("[Build] Output directory does not exist, no need to clean.");
  }
}

// Function to handle the build process
async function buildPlugin(): Promise<boolean> {
  const buildId = crypto.randomUUID();
  // Bundle only after generating its prompt dependency, including watch builds.
  await generatePromptManifest();
  // Ensure output directory exists
  try {
    await mkdir(OUTPUT_DIR, { recursive: true });
  } catch (error: unknown) {
    if (error && typeof error === "object" && "code" in error && error.code !== "EEXIST") {
      log.header(`${c.red}[Build] Error${c.reset}`);
      log.error(`Error creating output directory: ${error}`);
      return false;
    }
  }

  // Build the plugin
  const result = await Bun.build({
    entrypoints: [entryFile],
    outdir: OUTPUT_DIR,
    target: "node",
    format: "cjs",
    sourcemap: Bun.argv.includes("--sourcemap") ? "external" : "none",
    plugins: [blockbenchCompatPlugin, textFileLoaderPlugin],
    external: [
      "three",
      "tinycolor2",
      // Native modules that require permission in Blockbench v5.0+
      "node:module",
      "node:fs",
      "node:fs/promises",
      "node:child_process",
      "node:https",
      "node:net",
      "node:tls",
      "node:util",
      "node:os",
      "node:v8",
      "child_process",
      "http",
      "https",
      "net",
      "tls",
      "util",
      "os",
      "v8",
    ],
    minify: isProduction,
    // Compile-time constants for dead code elimination
    define: {
      "process.env.NODE_ENV": isProduction ? '"production"' : '"development"',
      __DEV__: isProduction ? "false" : "true",
      __BUILD_ID__: JSON.stringify(buildId),
    },
    // Remove debugger statements in production
    drop: isProduction ? ["debugger"] : [],
  });

  if (!result.success) {
    log.header(`${c.red}[Build] Failed${c.reset}`);
    for (const message of result.logs) {
      log.error(String(message));
    }
    return false;
  }

  log.header("[Build] Assets");

  const iconSource = resolve("./icon.svg");
  const iconDest = join(OUTPUT_DIR, "icon.svg");

  if (await Bun.file(iconSource).exists()) {
    await copyFile(iconSource, iconDest);
    log.step(`Copied ${c.cyan}icon.svg${c.reset}`);
  }

  const indexFile = join(OUTPUT_DIR, "index.js");
  const mcpFile = join(OUTPUT_DIR, "mcp.js");

  if (await Bun.file(indexFile).exists()) {
    await renameOutput(indexFile, mcpFile);
    log.step(`Renamed ${c.gray}index.js${c.reset} → ${c.cyan}mcp.js${c.reset}`);
  }

  const mcpBunFile = Bun.file(mcpFile);
  if (await mcpBunFile.exists()) {
    const mcpContent = await mcpBunFile.text();
    const banner = /* js */ `/* v${version} */
let process = requireNativeModule('process');
`;

    if (!mcpContent.startsWith(banner)) {
      await Bun.write(mcpFile, banner + mcpContent);
    }
  }

  // Rename the sourcemap file
  const indexMapFile = join(OUTPUT_DIR, "index.js.map");
  const mcpMapFile = join(OUTPUT_DIR, "mcp.js.map");

  if (await Bun.file(indexMapFile).exists()) {
    await renameOutput(indexMapFile, mcpMapFile);
    const map = await Bun.file(mcpMapFile).json();
    map.file = "mcp.js";
    // Two banner lines precede the generated bundle.
    map.mappings = ";;" + map.mappings;
    await Bun.write(mcpMapFile, JSON.stringify(map));
    await Bun.write(mcpFile, (await Bun.file(mcpFile).text()) + "\n//# sourceMappingURL=mcp.js.map\n");
    log.step(`Renamed ${c.gray}index.js.map${c.reset} → ${c.cyan}mcp.js.map${c.reset}`);
  }

  // Copy the README file
  const readmeSource = resolve("./about.md");
  const readmeDest = join(OUTPUT_DIR, "about.md");

  if (await Bun.file(readmeSource).exists()) {
    await copyFile(readmeSource, readmeDest);
    log.step(`Copied ${c.cyan}about.md${c.reset}`);
  }

  await Bun.write(join(OUTPUT_DIR,"build-info.json"),JSON.stringify({version,build_id:buildId},null,2));
  return true;
}

// Function to watch for file changes
function watchFiles() {
  log.info("[Build] Watching for changes...");

  // Build serialization to prevent overlapping builds
  let currentBuild: Promise<void> | null = null;
  let pendingRebuild = false;

  async function queueRebuild(filename: string) {
    // If a build is in progress, mark as pending and return
    if (currentBuild) {
      pendingRebuild = true;
      return;
    }

    // Start the build
    currentBuild = (async () => {
      do {
        pendingRebuild = false;
        log.header(`${c.yellow}[Build] Rebuild${c.reset}`);
        log.step(`File changed: ${c.cyan}${filename}${c.reset}`);
        try {
          if (await buildPlugin()) log.success("Rebuild complete");
        } catch (error) {
          log.error(`Rebuild failed: ${error}`);
        }
      } while (pendingRebuild);
    })();

    try {
      await currentBuild;
    } finally {
      currentBuild = null;
    }
  }

  const watcher = watch(
    "./",
    { recursive: true },
    (_eventType, filename) => {
      if (!filename) return;

      // Normalize filename for consistent comparison
      const normalizedFilename = normalize(filename);
      const root = normalizedFilename.split(sep)[0];
      if ([".git", ".verification", ".agents", ".codex", "node_modules", "tests", "docs"].includes(root)) return;
      // Ignore directory events (including the prompts directory event caused
      // by writing its manifest) and files unrelated to the plugin bundle.
      if (!/\.(?:ts|js|json|md|svg)$/.test(normalizedFilename)) return;

      // Ignore output directory (compare normalized paths)
      if (
        normalizedFilename === OUTPUT_DIR_NAME ||
        normalizedFilename.startsWith(`${OUTPUT_DIR_NAME}${sep}`)
      ) {
        return;
      }

      // Ignore other non-source files
      if (
        normalizedFilename.endsWith(".js.map") ||
        normalizedFilename.includes(".git") ||
        normalizedFilename.startsWith(`node_modules${sep}`) ||
        normalizedFilename === "node_modules" ||
        normalizedFilename.startsWith(`.verification${sep}`) ||
        normalizedFilename.startsWith(`tests${sep}`) ||
        normalizedFilename.startsWith(`docs${sep}`) ||
        normalizedFilename.endsWith(".test.ts") ||
        normalizedFilename === `prompts${sep}manifest.json`
      ) {
        return;
      }

      queueRebuild(filename);
    }
  );

  // Handle process termination
  process.on("SIGINT", () => {
    watcher.close();
    log.dim("[Build] Watch mode stopped");
    process.exit(0);
  });
}

async function main() {
  log.header("[Build] MCP Plugin");

  if (isCleanMode) {
    await cleanOutputDir();
  }

  if (isWatchMode) {
    log.info("Building with watch mode...");
    const success = await buildPlugin();
    if (success) {
      log.success(`Initial build completed. Output in ${c.cyan}${OUTPUT_DIR}${c.reset}`);
      watchFiles();
    }
  } else {
    log.info("Building...");
    const success = await buildPlugin();
    if (success) {
      log.success(`Build completed. Output in ${c.cyan}${OUTPUT_DIR}${c.reset}`);
    }
    if (!success) {
      process.exit(1);
    }
  }
}

main().catch((err) => {
  log.header(`${c.red}[Build] Fatal Error${c.reset}`);
  log.error(String(err));
  process.exit(1);
});
