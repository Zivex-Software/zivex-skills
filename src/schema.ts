import { z } from "zod";

const slug = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "must be lowercase letters, digits and single hyphens");

const names = z.array(slug).default([]);

export const scopeSchema = z.enum(["hybrid", "project", "global"]);
export type Scope = z.infer<typeof scopeSchema>;

export const agentIdSchema = z.enum(["claude-code", "cursor", "codex", "generic"]);
export type AgentId = z.infer<typeof agentIdSchema>;

/** Pack manifest: content/packs/<id>.yaml */
export const packSchema = z.strictObject({
  id: slug,
  title: z.string().min(1),
  hint: z.string().default(""),
  requires: names,
  rules: names,
  skills: names,
  agents: names,
  hooks: names,
  stacks: names,
});
export type Pack = z.infer<typeof packSchema>;

/** Agent Skills frontmatter (agentskills.io). Extra keys are allowed by the spec. */
export const skillFrontmatterSchema = z.looseObject({
  name: slug,
  description: z.string().min(1).max(1024),
  license: z.string().optional(),
  compatibility: z.string().max(500).optional(),
  metadata: z.record(z.string(), z.string()).optional(),
});
export type SkillFrontmatter = z.infer<typeof skillFrontmatterSchema>;

/** Subagent frontmatter (Claude Code style): name + description required. */
export const agentFrontmatterSchema = z.looseObject({
  name: slug,
  description: z.string().min(1),
});

/**
 * Sidecar for content/hooks/<name>.mjs: content/hooks/<name>.yaml.
 * Events/matchers per https://code.claude.com/docs/en/hooks
 */
export const hookMetaSchema = z.strictObject({
  event: z.enum([
    "PreToolUse",
    "PostToolUse",
    "Stop",
    "SubagentStop",
    "SessionStart",
    "UserPromptSubmit",
  ]),
  matcher: z.string().min(1).optional(),
  timeout: z.number().int().positive().optional(),
});
export type HookMeta = z.infer<typeof hookMetaSchema>;

export const itemKindSchema = z.enum(["rule", "skill", "agent", "hook"]);
export type ItemKind = z.infer<typeof itemKindSchema>;

const installedItemSchema = z.strictObject({
  kind: itemKindSchema,
  name: slug,
  agent: agentIdSchema,
  scope: z.enum(["project", "global"]),
  version: z.string(),
  /** Path (relative to the scope root, posix separators) -> sha256 of what we wrote. */
  files: z.record(z.string(), z.string()),
});
export type InstalledItem = z.infer<typeof installedItemSchema>;

/** zivex.json (project) and the global config share this shape. */
export const lockSchema = z.strictObject({
  version: z.literal(1),
  /** The selection that produced the items; `sync` and `update` replay it. */
  scope: scopeSchema.optional(),
  packs: z.array(slug).default([]),
  skills: z.array(slug).default([]),
  hooks: z.boolean().default(true),
  agents: z.array(agentIdSchema).default([]),
  items: z.array(installedItemSchema).default([]),
});
export type Lock = z.infer<typeof lockSchema>;
