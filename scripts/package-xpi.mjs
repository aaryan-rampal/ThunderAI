import { mkdir } from "node:fs/promises";
import { spawn } from "node:child_process";
import { join } from "node:path";

import { DEFAULT_DIST_DIR, readManifest, repoRootFromScript } from "./extension-files.mjs";

function runZip({ cwd, artifactPath }) {
  return new Promise((resolve, reject) => {
    const child = spawn("zip", ["-rq", artifactPath, "."], {
      cwd,
      stdio: "inherit",
    });

    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`zip exited with status ${code}`));
    });
  });
}

async function main() {
  const rootDir = repoRootFromScript(import.meta.url);
  const extensionDir = join(rootDir, DEFAULT_DIST_DIR);
  const manifest = await readManifest(extensionDir);
  const artifactsDir = join(rootDir, "artifacts");
  const artifactPath = join(artifactsDir, `ThunderAI-${manifest.version}.xpi`);

  await mkdir(artifactsDir, { recursive: true });
  await runZip({ cwd: extensionDir, artifactPath });

  process.stdout.write(`Packaged ${artifactPath}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
