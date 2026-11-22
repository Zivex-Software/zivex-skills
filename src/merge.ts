import { createHash } from "node:crypto";

export const sha256 = (data: string | Uint8Array) =>
  createHash("sha256").update(data).digest("hex");

// ---- Managed markdown sections (CLAUDE.md / AGENTS.md) ----
const begin = (id: string) => `<!-- zivex-skills:begin ${id} -->`;
const end = (id: string) => `<!-- zivex-skills:end ${id} -->`;

function locate(text: string, id: string): [number, number] | undefined {
  const s = text.indexOf(begin(id));
  if (s < 0) return undefined;
  const e = text.indexOf(end(id), s);
  if (e < 0)
    throw new Error(
      `Found "${begin(id)}" without its end marker. Add "${end(id)}" or delete the begin marker, then retry.`,
    );
  return [s, e + end(id).length];
}

/** Body between the markers (trimmed), or undefined if the section is absent. */
export function readSection(text: string, id: string): string | undefined {
  const at = locate(text, id);
  return at && text.slice(at[0] + begin(id).length, at[1] - end(id).length).trim();
}

export function upsertSection(text: string, id: string, body: string): string {
  const block = `${begin(id)}\n${body.trim()}\n${end(id)}`;
  const at = locate(text, id);
  if (at) return text.slice(0, at[0]) + block + text.slice(at[1]);
  const sep = !text ? "" : text.endsWith("\n\n") ? "" : text.endsWith("\n") ? "\n" : "\n\n";
  return `${text}${sep}${block}\n`;
}

export function removeSection(text: string, id: string): string {
  const at = locate(text, id);
  if (!at) return text;
  const out = text.slice(0, at[0]) + text.slice(at[1]).replace(/^\n/, "");
  return out.replace(/\n{3,}/g, "\n\n").trim() ? out : "";
}

// ---- Claude Code settings.json hooks ----
// Shape: https://code.claude.com/docs/en/hooks
// shortcut: settings are untyped JSON (we preserve unknown keys), type it if we need to read more of it.
export type Settings = Record<string, any>;

export interface HookEntry {
  name: string;
  event: string;
  matcher?: string;
  timeout?: number;
  command: string;
  args: string[];
}

/** Our entries are recognised by their script path: .../hooks/zivex/<name>.mjs */
const isOurs = (h: any, name: string) =>
  Array.isArray(h?.args) &&
  typeof h.args[0] === "string" &&
  h.args[0].replaceAll("\\", "/").endsWith(`/hooks/zivex/${name}.mjs`);

const toHook = (e: HookEntry) => ({
  type: "command",
  command: e.command,
  args: e.args,
  ...(e.timeout ? { timeout: e.timeout } : {}),
});

export function removeHook(settings: Settings, name: string): Settings {
  const out: Settings = structuredClone(settings);
  if (!out.hooks) return out;
  for (const event of Object.keys(out.hooks)) {
    out.hooks[event] = out.hooks[event]
      .map((g: any) => ({ ...g, hooks: (g.hooks ?? []).filter((h: any) => !isOurs(h, name)) }))
      .filter((g: any) => g.hooks.length > 0);
    if (out.hooks[event].length === 0) delete out.hooks[event];
  }
  if (Object.keys(out.hooks).length === 0) delete out.hooks;
  return out;
}

export function upsertHook(settings: Settings, e: HookEntry): Settings {
  const wanted = JSON.stringify(toHook(e));
  const groups: any[] = settings.hooks?.[e.event] ?? [];
  const exists = groups.some(
    (g) =>
      g.matcher === e.matcher &&
      (g.hooks ?? []).some((h: any) => isOurs(h, e.name) && JSON.stringify(h) === wanted),
  );
  if (exists) return settings;
  const out = removeHook(settings, e.name);
  out.hooks ??= {};
  out.hooks[e.event] ??= [];
  let group = out.hooks[e.event].find((g: any) => g.matcher === e.matcher);
  if (!group) {
    group = { ...(e.matcher ? { matcher: e.matcher } : {}), hooks: [] };
    out.hooks[e.event].push(group);
  }
  group.hooks.push(toHook(e));
  return out;
}
