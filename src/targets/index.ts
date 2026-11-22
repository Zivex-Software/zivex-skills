import type { AgentId } from "../schema.js";
import { claudeCode } from "./claude-code.js";
import { codex } from "./codex.js";
import { cursor } from "./cursor.js";
import { generic } from "./generic.js";
import type { Target } from "./types.js";

export const targets: Record<AgentId, Target> = {
  "claude-code": claudeCode,
  cursor,
  codex,
  generic,
};
export type { Ctx, Op, Plan, Target } from "./types.js";
