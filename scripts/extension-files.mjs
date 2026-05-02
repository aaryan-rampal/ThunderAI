import { access, cp, mkdir, readFile, rm } from "node:fs/promises";
import { join, resolve } from "node:path";

export const EXTENSION_COPY_ENTRIES = [
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
];

export const DEFAULT_DIST_DIR = "dist-extension";

export function repoRootFromScript(scriptUrl) {
  return resolve(new URL("..", scriptUrl).pathname);
}

async function pathExists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function addReferencedPath(paths, value) {
  if (typeof value === "string" && value.length > 0) {
    paths.add(value);
  }
}

function collectManifestReferences(manifest) {
  const paths = new Set();

  addReferencedPath(paths, manifest.background?.page);
  addReferencedPath(paths, manifest.options_ui?.page);
  addReferencedPath(paths, manifest.message_display_action?.default_popup);
  addReferencedPath(paths, manifest.compose_action?.default_popup);

  for (const iconPath of Object.values(manifest.icons ?? {})) {
    addReferencedPath(paths, iconPath);
  }

  for (const script of manifest.content_scripts ?? []) {
    for (const jsPath of script.js ?? []) {
      addReferencedPath(paths, jsPath);
    }
    for (const cssPath of script.css ?? []) {
      addReferencedPath(paths, cssPath);
    }
  }

  return [...paths].sort();
}

export async function readManifest(extensionDir) {
  const manifestPath = join(extensionDir, "manifest.json");
  const rawManifest = await readFile(manifestPath, "utf8");
  return JSON.parse(rawManifest);
}

export async function assertManifestReferences(extensionDir) {
  const manifest = await readManifest(extensionDir);
  const missingPaths = [];

  for (const relativePath of collectManifestReferences(manifest)) {
    if (!(await pathExists(join(extensionDir, relativePath)))) {
      missingPaths.push(relativePath);
    }
  }

  if (missingPaths.length > 0) {
    throw new Error(`Missing manifest-referenced files: ${missingPaths.join(", ")}`);
  }
}

export async function copyExtensionFiles({ rootDir, outDir }) {
  const resolvedRoot = resolve(rootDir);
  const resolvedOut = resolve(outDir);

  await rm(resolvedOut, { recursive: true, force: true });
  await mkdir(resolvedOut, { recursive: true });

  for (const entry of EXTENSION_COPY_ENTRIES) {
    const sourcePath = join(resolvedRoot, entry);
    if (!(await pathExists(sourcePath))) {
      continue;
    }

    await cp(sourcePath, join(resolvedOut, entry), {
      recursive: true,
      force: true,
      dereference: false,
    });
  }
}
