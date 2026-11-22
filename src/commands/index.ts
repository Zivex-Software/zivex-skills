/**
 * Command registry: every command is a lazy import so `--help` stays instant.
 * Extension point (Phase 2): add a `mcp` entry here (and its commander definition in cli.ts)
 * to ship `zivex-skills mcp`. Nothing else needs to change.
 */
export const commands = {
  init: () => import("./init.js"),
  add: () => import("./add.js"),
  remove: () => import("./remove.js"),
  list: () => import("./list.js"),
  update: () => import("./update.js"),
  doctor: () => import("./doctor.js"),
};
