import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vitest";
import { parse } from "yaml";

const root = join(import.meta.dirname, "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");
const list = (dir: string) => readdirSync(join(root, dir)).map((f) => join(dir, f));

test("every workflow, issue template and dependabot file is valid YAML", () => {
  const files = [
    ...list(".github/workflows"),
    ...list(".github/ISSUE_TEMPLATE"),
    ".github/dependabot.yml",
  ];
  for (const f of files) expect(() => parse(read(f)), f).not.toThrow();
});

test("CI runs with read-only permissions; only the publish workflow may request an OIDC token", () => {
  expect(parse(read(".github/workflows/ci.yml")).permissions).toEqual({ contents: "read" });
  expect(parse(read(".github/workflows/publish.yml")).permissions["id-token"]).toBe("write");
  for (const f of list(".github/workflows").filter((x) => !x.endsWith("publish.yml"))) {
    expect(parse(read(f)).permissions?.["id-token"], f).toBeUndefined();
  }
});
