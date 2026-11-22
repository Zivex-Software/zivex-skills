import { readLock, globalLockPath, projectLockPath } from "../lockfile.js";
import { createEnv } from "../env.js";
import { msg } from "../messages.js";
import type { CommonOpts } from "./shared.js";

export async function run(o: CommonOpts & { available?: boolean }) {
  const env = await createEnv();
  if (o.available) {
    const packs = [...env.content.packs.values()].map(({ id, title, hint }) => ({
      id,
      title,
      hint,
    }));
    if (o.json) return console.log(JSON.stringify(packs, null, 2));
    for (const x of packs)
      console.log(`${x.id.padEnd(24)} ${x.title}${x.hint ? ` - ${x.hint}` : ""}`);
    return;
  }
  const sections = [
    {
      label: "project",
      path: projectLockPath(env.projectRoot),
      lock: await readLock(projectLockPath(env.projectRoot)),
    },
    { label: "global", path: globalLockPath(), lock: await readLock(globalLockPath()) },
  ];
  if (o.json)
    return console.log(
      JSON.stringify(
        sections.map((s) => ({
          scope: s.label,
          packs: s.lock.packs,
          skills: s.lock.skills,
          items: s.lock.items.map(({ files: _f, ...i }) => i),
        })),
        null,
        2,
      ),
    );
  if (sections.every((s) => !s.lock.items.length)) return console.log(msg.emptyList);
  for (const s of sections) {
    if (!s.lock.items.length) continue;
    console.log(`${s.label} (${s.path})  packs: ${s.lock.packs.join(", ") || "-"}`);
    const grouped = new Map<string, { agents: string[]; version: string }>();
    for (const i of s.lock.items) {
      const g = grouped.get(`${i.kind} ${i.name}`) ?? { agents: [], version: i.version };
      g.agents.push(i.agent);
      grouped.set(`${i.kind} ${i.name}`, g);
    }
    for (const [k, g] of grouped)
      console.log(`  ${k.padEnd(40)} ${g.agents.join(", ")}  v${g.version}`);
  }
}
