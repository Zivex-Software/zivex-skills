import { join } from "node:path";
import { expect, test } from "vitest";
import { emptyLock, readLock, writeLock } from "../src/lockfile.js";
import { globalConfigDir, placeFor, resolveScope } from "../src/scopes.js";
import { tempDir, write } from "./helpers.js";

test("default scope depends on git repo; flags win; conflicts throw", () => {
  expect(resolveScope({}, true)).toBe("hybrid");
  expect(resolveScope({}, false)).toBe("global");
  expect(resolveScope({ project: true }, false)).toBe("project");
  expect(resolveScope({ global: true, scope: "global" }, true)).toBe("global");
  expect(() => resolveScope({ global: true, project: true }, true)).toThrow(/Conflicting/);
  expect(() => resolveScope({ scope: "nope" as never }, true)).toThrow(/Invalid scope/);
});

test("hybrid puts only rules in the user directory", () => {
  expect(placeFor("hybrid", "rule")).toBe("global");
  expect(placeFor("hybrid", "skill")).toBe("project");
  expect(placeFor("global", "skill")).toBe("global");
});

test("global config dir per OS", () => {
  expect(globalConfigDir({ APPDATA: "C:\\A" }, "win32", "H")).toBe(join("C:\\A", "zivex-skills"));
  expect(globalConfigDir({ XDG_CONFIG_HOME: "/x" }, "linux", "/h")).toBe(
    join("/x", "zivex-skills"),
  );
  expect(globalConfigDir({}, "darwin", "/h")).toBe(join("/h", ".config", "zivex-skills"));
});

test("lockfile: missing => empty, roundtrip is stable, corrupt throws with a fix", async () => {
  const dir = await tempDir();
  const p = join(dir, "sub", "zivex.json");
  expect(await readLock(p)).toEqual(emptyLock());
  const lock = { ...emptyLock(), packs: ["b", "a"] };
  await writeLock(p, lock);
  const first = await readLock(p);
  expect(first.packs).toEqual(["a", "b"]);
  await writeLock(p, first);
  expect(await readLock(p)).toEqual(first);
  await write(dir, { "bad.json": '{"version":2}' });
  await expect(readLock(join(dir, "bad.json"))).rejects.toThrow(/sync/);
});
