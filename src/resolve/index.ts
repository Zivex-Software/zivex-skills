import type { Content, Entry, Skill } from "../content.js";

export interface Resolved {
  /** Packs in dependency order (requirements first). */
  packs: string[];
  rules: Entry[];
  skills: Skill[];
  agents: Entry[];
  hooks: Entry[];
}

/** Expand pack ids with their `requires` closure, dedupe items, reject unknown ids and cycles. */
export function resolvePacks(content: Content, ids: string[]): Resolved {
  const order: string[] = [];
  const done = new Set<string>();
  const stack: string[] = [];
  const visit = (id: string) => {
    if (done.has(id)) return;
    const pack = content.packs.get(id);
    if (!pack)
      throw new Error(`Unknown pack "${id}". Run "zivex-skills list" to see available packs.`);
    if (stack.includes(id))
      throw new Error(`Pack dependency cycle: ${[...stack, id].join(" -> ")}`);
    stack.push(id);
    pack.requires.forEach(visit);
    stack.pop();
    done.add(id);
    order.push(id);
  };
  ids.forEach(visit);

  const pick = <T>(field: "rules" | "skills" | "agents" | "hooks", map: Map<string, T>): T[] => {
    const names = new Set(order.flatMap((id) => content.packs.get(id)![field]));
    return [...names].map((n) => map.get(n)!);
  };
  return {
    packs: order,
    rules: pick("rules", content.rules),
    skills: pick("skills", content.skills),
    agents: pick("agents", content.agents),
    hooks: pick("hooks", content.hooks),
  };
}
