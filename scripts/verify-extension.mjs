import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

import {
  DEFAULT_DIST_DIR,
  EXTENSION_COPY_ENTRIES,
  assertManifestReferences,
  repoRootFromScript,
} from "./extension-files.mjs";

async function readJsonFile(path) {
  const raw = await readFile(path, "utf8");
  return JSON.parse(raw);
}

async function verifyCopiedEntries(extensionDir) {
  for (const entry of EXTENSION_COPY_ENTRIES) {
    await readFile(join(extensionDir, entry)).catch(async (error) => {
      if (error?.code === "EISDIR") {
        await readdir(join(extensionDir, entry));
        return;
      }
      throw new Error(`Missing build output entry: ${entry}`);
    });
  }
}

async function verifyLocaleJson(extensionDir) {
  const localesDir = join(extensionDir, "_locales");
  const localeNames = await readdir(localesDir);

  for (const localeName of localeNames) {
    await readJsonFile(join(localesDir, localeName, "messages.json"));
  }
}

async function main() {
  const rootDir = repoRootFromScript(import.meta.url);
  const extensionDir = join(rootDir, DEFAULT_DIST_DIR);

  await readJsonFile(join(extensionDir, "manifest.json"));
  await verifyCopiedEntries(extensionDir);
  await assertManifestReferences(extensionDir);
  await verifyLocaleJson(extensionDir);

  process.stdout.write(`Verified extension build in ${extensionDir}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
