# Fork Toolchain

This fork builds ThunderAI into a generated extension directory before packaging or
deployment. The source files remain in their existing locations for now.

## Commands

```sh
pnpm run test
pnpm run build
pnpm run verify
pnpm run package:xpi
```

- `test` runs the Node test suite for the tooling.
- `build` copies runtime extension files into `dist-extension/`.
- `verify` rebuilds and checks the generated extension manifest and locales.
- `package:xpi` rebuilds, verifies, and writes `artifacts/ThunderAI-<version>.xpi`.

`dist-extension/` and `artifacts/` are generated and ignored by git.

## Deploying To A Thunderbird Development Directory

Set `THUNDERAI_DEPLOY_DIR` to an unpacked extension directory in a disposable
Thunderbird development profile, then run:

```sh
THUNDERAI_DEPLOY_DIR=/path/to/thunderbird/profile/extensions/thunderai-dev pnpm run deploy
```

The deploy script copies the generated `dist-extension/` contents into that
directory. It does not manage Thunderbird itself.

## Manual Smoke Test

Use a disposable Thunderbird profile first.

1. Build or package the extension.
2. Load `dist-extension/` as a temporary add-on, or install the generated XPI.
3. Open the ThunderAI popup from a message view.
4. Open the ThunderAI popup from a compose window.
5. Confirm the options page opens.
6. Run one low-risk prompt.
7. Check the Thunderbird console for extension errors.
