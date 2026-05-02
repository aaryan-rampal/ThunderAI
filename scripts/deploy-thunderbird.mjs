import { cp, mkdir } from "node:fs/promises";
import { join, resolve } from "node:path";

import { DEFAULT_DIST_DIR, repoRootFromScript } from "./extension-files.mjs";

async function main() {
  const deployDir = process.env.THUNDERAI_DEPLOY_DIR;
  if (!deployDir) {
    throw new Error("Set THUNDERAI_DEPLOY_DIR to the Thunderbird development extension directory.");
  }

  const rootDir = repoRootFromScript(import.meta.url);
  const extensionDir = join(rootDir, DEFAULT_DIST_DIR);
  const resolvedDeployDir = resolve(deployDir);

  await mkdir(resolvedDeployDir, { recursive: true });
  await cp(extensionDir, resolvedDeployDir, {
    recursive: true,
    force: true,
    dereference: false,
  });

  process.stdout.write(`Deployed ${extensionDir} -> ${resolvedDeployDir}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
