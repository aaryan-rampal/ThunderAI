import { join } from "node:path";

import {
  DEFAULT_DIST_DIR,
  assertManifestReferences,
  copyExtensionFiles,
  repoRootFromScript,
} from "./extension-files.mjs";

async function main() {
  const rootDir = repoRootFromScript(import.meta.url);
  const outDir = join(rootDir, DEFAULT_DIST_DIR);

  await copyExtensionFiles({ rootDir, outDir });
  await assertManifestReferences(outDir);

  process.stdout.write(`Built extension files in ${outDir}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
