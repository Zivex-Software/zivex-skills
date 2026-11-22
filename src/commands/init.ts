import * as p from "@clack/prompts";
import { detectAgents, detectStack } from "../detect/index.js";
import { createEnv } from "../env.js";
import { homeLockPath, runInstall, shorten } from "../install.js";
import { readLock } from "../lockfile.js";
import { agentLabel, msg } from "../messages.js";
import type { AgentId, Scope } from "../schema.js";
import { CliError, csv, installAndReport, interactive, parseAgents, scopeOf } from "./shared.js";
import type { CommonOpts } from "./shared.js";

function bail<T>(v: T): Exclude<T, symbol> {
  if (p.isCancel(v)) {
    p.cancel(msg.cancelled);
    process.exit(0);
  }
  return v as Exclude<T, symbol>;
}

export async function run(o: CommonOpts) {
  const env = await createEnv();
  const ui = interactive(o);
  if (ui) p.intro(msg.intro);

  const spin = ui ? p.spinner() : undefined;
  spin?.start(msg.scanning);
  const stack = await detectStack(env.projectRoot);
  const detected = await detectAgents(env.projectRoot, env.home);
  spin?.stop(
    msg.scanned(
      stack.dotnet,
      detected.map((a) => agentLabel[a]),
    ),
  );
  if (ui && !stack.dotnet) p.log.warn(msg.noDotnet);

  const available = [...env.content.packs.values()].filter((x) => x.id !== "foundation");
  const missing = [!o.agents && "--agents", !o.packs && "--packs"].filter(Boolean) as string[];
  if (!ui && !o.yes && missing.length) throw new CliError(msg.missingFlags(missing));

  // Scope
  let scope: Scope = scopeOf(env, o);
  if (ui && !o.global && !o.project && !o.scope) {
    const choices: Scope[] = env.inRepo ? ["hybrid", "project", "global"] : ["global", "project"];
    scope = bail(
      await p.select<Scope>({
        message: msg.askScope,
        initialValue: scope,
        options: choices.map((s) => ({
          value: s,
          label: msg.scopeOptions[s].label,
          hint: msg.scopeOptions[s].hint,
        })),
      }),
    );
  }

  // Agents
  let agents = parseAgents(o.agents);
  if (!o.agents) {
    if (ui) {
      agents = bail(
        await p.multiselect<AgentId>({
          message: msg.askAgents,
          initialValues: detected,
          required: true,
          options: (["claude-code", "cursor", "codex", "generic"] as const).map((a) => ({
            value: a,
            label: agentLabel[a],
          })),
        }),
      );
    } else {
      agents = detected;
      if (!agents.length) throw new CliError(msg.noAgentsDetected);
    }
  }

  // Cursor has no global rules file, so hybrid scope needs a decision (non-interactive: project + notice).
  let noRules: AgentId[] = [];
  if (ui && scope === "hybrid" && agents.includes("cursor")) {
    if (!bail(await p.confirm({ message: msg.askCursorRules, initialValue: true })))
      noRules = ["cursor"];
  }

  // Packs
  let packs: string[];
  if (o.packs) {
    packs = csv(o.packs);
    for (const id of packs)
      if (!available.some((x) => x.id === id))
        throw new CliError(
          msg.unknownPack(
            id,
            available.map((x) => x.id),
          ),
        );
  } else if (ui) {
    const option = (x: (typeof available)[number]) => ({
      value: x.id,
      label: x.title,
      hint: x.hint,
    });
    p.note(msg.foundationNote);
    const stackIds = available.filter((x) => !x.id.startsWith("workflow-"));
    packs = bail(
      await p.groupMultiselect<string>({
        message: msg.askPacks,
        required: false,
        initialValues: available
          .filter((x) => x.stacks.some((s) => s === "dotnet" && stack.dotnet))
          .map((x) => x.id),
        options: {
          [msg.groupWorkflows]: available.filter((x) => x.id.startsWith("workflow-")).map(option),
          [msg.groupStack]: stackIds.map(option),
        },
      }),
    );
  } else {
    packs = available.map((x) => x.id);
  }
  if (env.content.packs.has("foundation"))
    packs = ["foundation", ...packs.filter((x) => x !== "foundation")];

  // Hooks
  let hooks = o.hooks;
  if (hooks === undefined)
    hooks = ui ? bail(await p.confirm({ message: msg.askHooks, initialValue: true })) : true;

  const sel = { packs, skills: [] as string[], agents, hooks, scope, noRules };
  const prior = await readLock(homeLockPath(env, scope));
  sel.skills = prior.skills;

  // Summary of exactly what will be written
  if (ui && !o.dryRun) {
    const plan = await runInstall(env, sel, { dryRun: true, pin: o.pin });
    const lines = plan.applied
      .filter((a) => a.status !== "unchanged")
      .map((a) => shorten(a.key, env));
    const shown = lines
      .slice(0, 25)
      .concat(lines.length > 25 ? [`... and ${lines.length - 25} more`] : []);
    p.note(shown.join("\n") || msg.nothingToDo, msg.summaryTitle);
    if (lines.length && bail(await p.confirm({ message: msg.confirmGo })) !== true) {
      p.cancel(msg.cancelled);
      return;
    }
  }

  if (ui) p.log.step(msg.working);
  await installAndReport(env, sel, o);
  if (ui)
    p.outro(msg.outro(env.content.skills.has("dotnet-conventions-bootstrap") && packs.length > 0));
}
