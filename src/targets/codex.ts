import { join } from "node:path";
import { frontmatter } from "../content.js";
import { placeFor } from "../scopes.js";
import { readText, rootFor, skillOps } from "./shared.js";
import type { Op, Target } from "./types.js";

// Verified against the Codex docs (developers.openai.com/codex -> learn.chatgpt.com/docs):
// - /docs/agent-configuration/agents-md : AGENTS.md in the project root, ~/.codex (CODEX_HOME) globally
//   (AGENTS.override.md, if present, takes precedence over AGENTS.md at the same level)
// - /docs/build-skills   : skills in .agents/skills (project) and ~/.agents/skills (user)
// - /docs/agent-configuration/subagents : TOML files in .codex/agents or ~/.codex/agents
// - hooks.json requires per-user trust review and its format was not verified, so hooks are not installed.

/** JSON string escapes are a subset of TOML basic-string escapes. */
const toml = (v: string) => JSON.stringify(v);

export const codex: Target = {
  id: "codex",
  async plan(res, ctx) {
    const ops: Op[] = [];
    const notices: string[] = [];

    const rulePlace = placeFor(ctx.scope, "rule");
    for (const rule of res.rules) {
      ops.push({
        type: "section",
        item: { kind: "rule", name: rule.name },
        agent: "codex",
        place: rulePlace,
        path: join(rulePlace === "project" ? ctx.projectRoot : ctx.codexHome, "AGENTS.md"),
        id: rule.name,
        body: await readText(rule.path),
      });
    }

    const skillPlace = placeFor(ctx.scope, "skill");
    ops.push(
      ...(await skillOps(
        res.skills,
        "codex",
        skillPlace,
        join(rootFor(ctx, skillPlace), ".agents", "skills"),
      )),
    );

    const agentPlace = placeFor(ctx.scope, "agent");
    for (const agent of res.agents) {
      const fm = frontmatter(await readText(agent.path))!;
      const data = fm.data as { name: string; description: string };
      ops.push({
        type: "file",
        item: { kind: "agent", name: agent.name },
        agent: "codex",
        place: agentPlace,
        path: join(
          agentPlace === "project" ? join(ctx.projectRoot, ".codex") : ctx.codexHome,
          "agents",
          `${agent.name}.toml`,
        ),
        content: `name = ${toml(data.name)}\ndescription = ${toml(data.description)}\ndeveloper_instructions = ${toml(fm.body.trim())}\n`,
      });
    }

    if (res.hooks.length)
      notices.push(
        "Codex: hooks were not installed (hooks.json needs per-user trust and its format is unverified).",
      );
    return { ops, notices };
  },
};
