import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import {
  EXTENSION_COPY_ENTRIES,
  assertManifestReferences,
  copyExtensionFiles,
} from "../scripts/extension-files.mjs";

test("extension copy entries include runtime assets and exclude repo tooling", () => {
  assert.deepEqual(EXTENSION_COPY_ENTRIES, [
    "_locales",
    "api_webchat",
    "images",
    "js",
    "options",
    "pages",
    "popup",
    "manifest.json",
    "mzta-background.html",
    "mzta-background.js",
  ]);
});

test("copyExtensionFiles copies only allowlisted extension files", async (t) => {
  const tempDir = await mkdtemp(join(tmpdir(), "thunderai-toolchain-"));
  const root = join(tempDir, "repo");
  const out = join(tempDir, "dist-extension");

  await mkdir(join(root, "popup"), { recursive: true });
  await mkdir(join(root, ".github"), { recursive: true });
  await writeFile(join(root, "manifest.json"), "{}\n");
  await writeFile(join(root, "mzta-background.html"), "<script></script>\n");
  await writeFile(join(root, "mzta-background.js"), "console.log('runtime');\n");
  await writeFile(join(root, "popup", "mzta-popup.html"), "<body></body>\n");
  await writeFile(join(root, ".github", "workflow.yml"), "name: no\n");
  await writeFile(join(root, "README.md"), "# no\n");

  await copyExtensionFiles({ rootDir: root, outDir: out });

  assert.equal(await readFile(join(out, "manifest.json"), "utf8"), "{}\n");
  assert.equal(await readFile(join(out, "popup", "mzta-popup.html"), "utf8"), "<body></body>\n");
  await assert.rejects(readFile(join(out, ".github", "workflow.yml"), "utf8"), /ENOENT/);
  await assert.rejects(readFile(join(out, "README.md"), "utf8"), /ENOENT/);

  await rm(tempDir, { recursive: true, force: true });
});

test("assertManifestReferences rejects missing runtime files", async (t) => {
  const tempDir = await mkdtemp(join(tmpdir(), "thunderai-toolchain-"));
  const root = join(tempDir, "extension");
  await mkdir(root, { recursive: true });
  await writeFile(
    join(root, "manifest.json"),
    JSON.stringify({
      background: { page: "missing-background.html" },
      options_ui: { page: "missing-options.html" },
      message_display_action: { default_popup: "missing-popup.html" },
      compose_action: { default_popup: "missing-compose-popup.html" },
      icons: { 16: "missing-icon.png" },
      content_scripts: [{ js: ["missing-content.js"] }],
    })
  );

  await assert.rejects(
    assertManifestReferences(root),
    /Missing manifest-referenced files:/
  );

  await rm(tempDir, { recursive: true, force: true });
});
