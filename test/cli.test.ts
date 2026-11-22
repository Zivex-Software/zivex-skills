import { expect, test } from "vitest";
import { Command } from "@commander-js/extra-typings";

test("program name is zivex-skills", () => {
  const p = new Command().name("zivex-skills");
  expect(p.name()).toBe("zivex-skills");
});
