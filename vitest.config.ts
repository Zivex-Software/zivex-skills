import { defineConfig } from "vitest/config";

// Generous: tests hit the filesystem, and CI runners (Windows especially) can be slow.
export default defineConfig({ test: { testTimeout: 30_000 } });
