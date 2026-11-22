import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { loadContent } from "./content.js";
import type { Content } from "./content.js";
import { findGitRoot } from "./detect/index.js";

export interface Env {
  cwd: string;
  /** Git root when inside a repo, otherwise the current directory. */
  projectRoot: string;
  inRepo: boolean;
  home: string;
  codexHome: string;
  version: string;
  content: Content;
}

/** package.json sits one level above both src/ and dist/. */
export const packageVersion = (): string =>
  JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;

export async function createEnv(cwd = process.cwd()): Promise<Env> {
  const git = await findGitRoot(cwd);
  const home = homedir();
  return {
    cwd,
    projectRoot: git ?? cwd,
    inRepo: !!git,
    home,
    codexHome: process.env.CODEX_HOME || join(home, ".codex"),
    version: packageVersion(),
    content: await loadContent(),
  };
}
