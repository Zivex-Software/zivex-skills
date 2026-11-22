import { join } from "node:path";
import { placeFor } from "../scopes.js";
import { rootFor, skillOps } from "./shared.js";
import type { Target } from "./types.js";

// Open Agent Skills layout (https://agentskills.io/specification); paths per
// https://github.com/vercel-labs/skills/blob/main/docs/agents.md ("universal": .agents/skills, ~/.config/agents/skills).
// Skills only: there is no standard for rules, hooks or subagents.
export const generic: Target = {
  id: "generic",
  async plan(res, ctx) {
    const place = placeFor(ctx.scope, "skill");
    const base =
      place === "project"
        ? join(rootFor(ctx, place), ".agents", "skills")
        : join(ctx.home, ".config", "agents", "skills");
    return { ops: await skillOps(res.skills, "generic", place, base), notices: [] };
  },
};
