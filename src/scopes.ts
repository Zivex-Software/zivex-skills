import { homedir } from "node:os";
import { join } from "node:path";
import { scopeSchema } from "./schema.js";
import type { ItemKind, Scope } from "./schema.js";

export interface ScopeFlags {
  global?: boolean;
  project?: boolean;
  scope?: Scope;
}

/** Flags win; otherwise hybrid inside a git repo and global outside. */
export function resolveScope(flags: ScopeFlags, inGitRepo: boolean): Scope {
  if (flags.scope && !scopeSchema.safeParse(flags.scope).success) {
    throw new Error(`Invalid scope "${flags.scope}". Use hybrid, project or global.`);
  }
  const chosen = [flags.global && "global", flags.project && "project", flags.scope].filter(
    Boolean,
  );
  if (new Set(chosen).size > 1) {
    throw new Error("Conflicting scope flags. Use only one of --global, --project or --scope.");
  }
  return (chosen[0] as Scope | undefined) ?? (inGitRepo ? "hybrid" : "global");
}

/** Where one kind of item goes for a scope: hybrid puts only the foundation rules in the user directory. */
export function placeFor(scope: Scope, kind: ItemKind): "project" | "global" {
  if (scope === "hybrid") return kind === "rule" ? "global" : "project";
  return scope;
}

/** Global config dir: %APPDATA% on Windows, otherwise $XDG_CONFIG_HOME or ~/.config. */
export function globalConfigDir(
  env = process.env,
  platform = process.platform,
  home = homedir(),
): string {
  if (platform === "win32")
    return join(env.APPDATA || join(home, "AppData", "Roaming"), "zivex-skills");
  return join(env.XDG_CONFIG_HOME || join(home, ".config"), "zivex-skills");
}
