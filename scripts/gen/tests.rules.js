// @scope tests
const RULES = [
  {
    id: "TST001",
    level: "high",
    re: /\bAssert\.True\(\s*true\s*\)|\bAssert\.(False)\(\s*false\s*\)|\.Should\(\)\.BeTrue\(\)\s*;\s*\/\/\s*always/,
    msg: "Assertion that can never fail",
    fix: "Assert on the behaviour under test.",
  },
  {
    id: "TST002",
    level: "medium",
    re: /\bThread\.Sleep\s*\(|\bTask\.Delay\s*\(/,
    msg: "Sleeping in a test (slow and flaky)",
    fix: "Wait on the condition (await the task, poll with a timeout, use a fake TimeProvider/clock).",
  },
  {
    id: "TST003",
    level: "medium",
    re: /\b(Fact|Theory|Test|TestMethod|TestCase)\b[^\]]*\b(Skip|Ignore)\b|\[Ignore\b|\[Skip\b/,
    msg: "Skipped or ignored test",
    fix: "Fix or delete it; if it must stay, give a reason and an issue link in the Skip text.",
  },
  {
    id: "TST004",
    level: "medium",
    re: /\bDateTime(Offset)?\.(Now|UtcNow|Today)\b/,
    msg: "Wall-clock time in a test",
    fix: "Inject TimeProvider (FakeTimeProvider from Microsoft.Extensions.TimeProvider.Testing) so results do not depend on when the test runs.",
  },
  {
    id: "TST005",
    level: "low",
    re: /\bUseInMemoryDatabase\s*\(/,
    msg: "EF Core InMemory provider in a test",
    fix: "It does not enforce constraints, transactions or SQL translation; use SQLite in-memory or a real database via Testcontainers for data-access behaviour.",
  },
  {
    id: "TST006",
    level: "low",
    re: /\bnew\s+Random\s*\(\s*\)/,
    msg: "Unseeded randomness in a test",
    fix: "Use a fixed seed or fixed values so failures are reproducible.",
  },
  {
    id: "TST007",
    level: "low",
    re: /\bConsole\.(Write|WriteLine)\s*\(/,
    msg: "Console output in a test",
    fix: "Use the framework's output helper (ITestOutputHelper) or remove it.",
  },
  {
    id: "TST008",
    level: "high",
    re: /\.(Result|Wait\s*\(\s*\)|GetAwaiter\s*\(\s*\)\.GetResult\s*\(\s*\))(?![\w(])/,
    msg: "Blocking on a Task in a test (deadlocks, hides exceptions as AggregateException)",
    fix: "Make the test async Task and await.",
  },
  {
    id: "TST009",
    level: "high",
    fn: (text) => {
      // A test method with no assertion/verification at all (xUnit/NUnit/MSTest attributes): heuristic on method bodies.
      const lines = text.split("\n");
      const hits = [];
      for (let i = 0; i < lines.length; i++) {
        if (!/^\s*\[(Fact|Theory|Test|TestCase|TestMethod)\b/.test(lines[i])) continue;
        // [Fact] public void X() { ... } on one line: the method starts on this line.
        const own = lines[i].replace(/\[[^\]]*\]/g, "");
        let j = /\w\s*\(/.test(own) ? i : i + 1;
        while (j < lines.length && !/\b\w+\s*\(/.test(lines[j].replace(/\[[^\]]*\]/g, ""))) j++;
        let depth = 0;
        let started = false;
        let body = "";
        for (let k = j; k < lines.length; k++) {
          for (const ch of lines[k]) {
            if (ch === "{") {
              depth++;
              started = true;
            }
            if (ch === "}") depth--;
          }
          body += `${lines[k]}\n`;
          if ((started && depth === 0) || (!started && /=>[^;]*;\s*$/.test(lines[k]))) break;
        }
        if (
          !/\b(Assert\w*|Should\w*|Verify\w*|Throws\w*|Expect\w*|Received|MustHaveHappened|Matches|Snapshot|Equal|True|False)\b/.test(
            body,
          )
        )
          hits.push(i + 1);
      }
      return hits;
    },
    msg: "Test has no assertion or verification",
    fix: "Assert the outcome; a test that only runs code proves nothing (or delete it).",
  },
  {
    id: "TST010",
    level: "medium",
    project: (files) => {
      const hasTests = files.some((f) => f.cs && /\[(Fact|Theory|Test|TestMethod)\b/.test(f.text));
      return hasTests &&
        !files.some((f) => f.cs && /WebApplicationFactory|TestServer|Testcontainers/.test(f.text))
        ? [{ file: files.find((f) => f.cs)?.rel ?? "." }]
        : [];
    },
    msg: "Tests exist but none exercise the HTTP pipeline or a real database (no WebApplicationFactory, TestServer or Testcontainers)",
    fix: "Add at least one integration test per module through its endpoints against a real database.",
  },
];
