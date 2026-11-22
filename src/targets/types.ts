import type { Content, Entry, Hook, Skill } from "../content.js";
import type { AgentId, ItemKind, Scope } from "../schema.js";
import type { HookEntry } from "../merge.js";
import type { Resolved } from "../resolve/index.js";

export interface Ctx {
  content: Content;
  projectRoot: string;
  home: string;
  /** Codex home: $CODEX_HOME or ~/.codex. */
  codexHome: string;
  scope: Scope;
  /** Agents that must not receive always-on rules (user declined). */
  noRules?: AgentId[];
}

interface Base {
  item: { kind: ItemKind; name: string };
  agent: AgentId;
  place: "project" | "global";
  /** Absolute path of the file this op writes to or merges into. */
  path: string;
}
export type Op =
  | (Base & { type: "file"; content: Uint8Array | string })
  /** Managed markdown section, one per rule. `preambleIfNew` seeds a file we create. */
  | (Base & { type: "section"; id: string; body: string; preambleIfNew?: string })
  | (Base & { type: "hooks"; entry: HookEntry });

export interface Plan {
  ops: Op[];
  /** Things we deliberately did not install for this agent, with the reason. */
  notices: string[];
}

export interface Target {
  id: AgentId;
  plan(res: Resolved, ctx: Ctx): Promise<Plan>;
}
export type { Entry, Hook, Skill };
