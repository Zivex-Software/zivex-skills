import { readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { placeFor } from "../scopes.js";
import { rootFor, readText, skillOps } from "./shared.js";
import type { Ctx, Op, Plan, Target } from "./types.js";
import type { Resolved } from "../resolve/index.js";

// Verified against https://code.claude.com/docs/en/skills, /sub-agents, /hooks, /settings, /memory
// - skills: <root>/.claude/skills/<name>/SKILL.md      - subagents: <root>/.claude/agents/<name>.md
// - hooks: <root>/.claude/settings.json (shared; settings.local.json is never touched)
// - rules: CLAUDE.md (project: ./CLAUDE.md or ./.claude/CLAUDE.md; user: ~/.claude/CLAUDE.md)
// - Claude reads AGENTS.md only when no CLAUDE.md exists, so a new CLAUDE.md imports it with @AGENTS.md.

const exists = (p: string) =>
  stat(p).then(
    () => true,
    () => false,
  );

async function memoryFile(ctx: Ctx, place: "project" | "global") {
  if (place === "global") return { path: join(ctx.home, ".claude", "CLAUDE.md") };
  for (const p of [
    join(ctx.projectRoot, "CLAUDE.md"),
    join(ctx.projectRoot, ".claude", "CLAUDE.md"),
  ]) {
    if (await exists(p)) return { path: p };
  }
  const path = join(ctx.projectRoot, "CLAUDE.md");
  return (await exists(join(ctx.projectRoot, "AGENTS.md")))
    ? { path, preambleIfNew: "@AGENTS.md\n" }
    : { path };
}

export const claudeCode: Target = {
  id: "claude-code",
  async plan(res: Resolved, ctx: Ctx): Promise<Plan> {
    const ops: Op[] = [];
    const dir = (kind: "rule" | "skill" | "agent" | "hook") => {
      const place = placeFor(ctx.scope, kind);
      return { place, base: join(rootFor(ctx, place), ".claude") };
    };

    const r = dir("rule");
    const mem = res.rules.length ? await memoryFile(ctx, r.place) : undefined;
    for (const rule of res.rules) {
      ops.push({
        type: "section",
        item: { kind: "rule", name: rule.name },
        agent: "claude-code",
        place: r.place,
        path: mem!.path,
        id: rule.name,
        body: await readText(rule.path),
        preambleIfNew: mem!.preambleIfNew,
      });
    }

    const s = dir("skill");
    ops.push(...(await skillOps(res.skills, "claude-code", s.place, join(s.base, "skills"))));

    const a = dir("agent");
    for (const agent of res.agents) {
      ops.push({
        type: "file",
        item: { kind: "agent", name: agent.name },
        agent: "claude-code",
        place: a.place,
        path: join(a.base, "agents", `${agent.name}.md`),
        content: await readFile(agent.path),
      });
    }

    const h = dir("hook");
    for (const hook of res.hooks) {
      const script = join(h.base, "hooks", "zivex", `${hook.name}.mjs`);
      const item = { kind: "hook", name: hook.name } as const;
      ops.push({
        type: "file",
        item,
        agent: "claude-code",
        place: h.place,
        path: script,
        content: await readFile(hook.path),
      });
      ops.push({
        type: "hooks",
        item,
        agent: "claude-code",
        place: h.place,
        path: join(h.base, "settings.json"),
        entry: {
          name: hook.name,
          event: hook.meta.event,
          matcher: hook.meta.matcher,
          timeout: hook.meta.timeout,
          command: "node",
          // Project hooks are committed, so they must not contain machine paths.
          args: [
            h.place === "project"
              ? `\${CLAUDE_PROJECT_DIR}/.claude/hooks/zivex/${hook.name}.mjs`
              : script,
          ],
        },
      });
    }
    return { ops, notices: [] };
  },
};
