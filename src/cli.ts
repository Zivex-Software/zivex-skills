#!/usr/bin/env node
import { Command } from "@commander-js/extra-typings";
import { commands } from "./commands/index.js";
import { msg } from "./messages.js";
import { packageVersion } from "./env.js";

export function buildProgram() {
  const program = new Command()
    .name("zivex-skills")
    .description(msg.cli.description)
    .version(packageVersion())
    .addHelpText("after", `\n${msg.cli.examples}\n`);

  // Options are parsed into untyped objects and narrowed by each command's CommonOpts.
  const scoped = (c: Command<any, any, any>): any =>
    c
      .option("-g, --global", msg.flags.global)
      .option("--project", msg.flags.project)
      .option("--scope <scope>", msg.flags.scope)
      .option("--dry-run", msg.flags.dryRun)
      .option("--force", msg.flags.force)
      .option("-y, --yes", msg.flags.yes);

  scoped(program.command("init").description("Interactive installer"))
    .option("--agents <list>", msg.flags.agents)
    .option("--packs <list>", msg.flags.packs)
    .option("--hooks", msg.flags.hooks)
    .option("--no-hooks", msg.flags.noHooks)
    .option("--pin", msg.flags.pin)
    .action(async (o: any) => (await commands.init()).run(o));

  scoped(
    program
      .command("add")
      .description("Add a pack or a single skill")
      .argument("<name>", "pack or skill"),
  )
    .option("--agents <list>", msg.flags.agents)
    .option("--hooks", msg.flags.hooks)
    .option("--no-hooks", msg.flags.noHooks)
    .option("--pin", msg.flags.pin)
    .action(async (name: string, o: any) => (await commands.add()).run(name, o));

  scoped(
    program
      .command("remove")
      .description("Remove a pack or skill, or everything")
      .argument("[name]", "pack or skill"),
  )
    .option("--all", msg.flags.all)
    .action(async (name: string | undefined, o: any) => (await commands.remove()).run(name, o));

  scoped(program.command("list").description("Show what is installed (project and global)"))
    .option("--available", "show the packs you can install")
    .option("--json", msg.flags.json)
    .action(async (o: any) => (await commands.list()).run(o));

  scoped(program.command("update").description("Update installed content to this version"))
    .option("--all", "update project and global")
    .action(async (o: any) => (await commands.update()).update(o));

  scoped(program.command("sync").description("Make this project match zivex.json")).action(
    async (o: any) => (await commands.update()).sync(o),
  );

  scoped(program.command("doctor").description("Check paths, hooks, duplicates and version drift"))
    .option("--json", msg.flags.json)
    .action(async (o: any) => (await commands.doctor()).run(o));

  return program;
}

function fail(e: unknown): never {
  const err = e as NodeJS.ErrnoException & { issues?: string[] };
  const text =
    err.code === "EACCES" || err.code === "EPERM"
      ? msg.permission(err.path ?? "the target path")
      : err.issues
        ? `${msg.invalidContent}\n${err.issues.map((i) => `  - ${i}`).join("\n")}`
        : err.message;
  process.stderr.write(`error: ${text}\n`);
  process.exit(1);
}

buildProgram().parseAsync().catch(fail);
