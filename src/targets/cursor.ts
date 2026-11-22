import { join } from "node:path";
import { placeFor } from "../scopes.js";
import { readText, rootFor, skillOps } from "./shared.js";
import type { Op, Target } from "./types.js";

// Verified against https://cursor.com/docs/context/rules and https://cursor.com/docs/context/skills
// - rules: .cursor/rules/*.mdc (frontmatter: description, globs, alwaysApply). User rules are UI-only (no file).
// - skills: project .agents/skills (shared with Codex/generic), user ~/.cursor/skills
// - subagent/hook file locations are not documented there, so they are not installed.

const description = (text: string) => /^#\s+(.+)$/m.exec(text)?.[1]?.trim() ?? "Zivex rule";

export const cursor: Target = {
  id: "cursor",
  async plan(res, ctx) {
    const ops: Op[] = [];
    const notices: string[] = [];

    if (res.rules.length && placeFor(ctx.scope, "rule") === "global") {
      notices.push(
        "Cursor has no global rules file (user rules live in Settings), so rules were written to the project instead.",
      );
    }
    for (const rule of res.rules) {
      const text = (await readText(rule.path)).trim();
      ops.push({
        type: "file",
        item: { kind: "rule", name: rule.name },
        agent: "cursor",
        place: "project",
        path: join(ctx.projectRoot, ".cursor", "rules", `zivex-${rule.name}.mdc`),
        content: `---\ndescription: ${JSON.stringify(description(text))}\nalwaysApply: true\n---\n\n${text}\n`,
      });
    }

    const place = placeFor(ctx.scope, "skill");
    const base =
      place === "project"
        ? join(ctx.projectRoot, ".agents", "skills")
        : join(rootFor(ctx, place), ".cursor", "skills");
    ops.push(...(await skillOps(res.skills, "cursor", place, base)));

    if (res.agents.length)
      notices.push("Cursor: subagents were not installed (no documented file location).");
    if (res.hooks.length)
      notices.push("Cursor: hooks were not installed (no documented file location).");
    return { ops, notices };
  },
};
