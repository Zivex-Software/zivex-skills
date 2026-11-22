import { defineConfig } from "tsdown";

// One bundled ESM output; the shebang in src/cli.ts is preserved by tsdown.
export default defineConfig({
  entry: { cli: "src/cli.ts" },
  format: "esm",
  platform: "node",
  target: "node22",
  clean: true,
  dts: false,
});
