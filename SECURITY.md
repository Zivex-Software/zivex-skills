# Security policy

## Supported versions

Only the latest released version of `zivex-skills` receives security fixes.

## Reporting a vulnerability

Please **do not open a public issue**. Report it privately through GitHub:
**Security -> Report a vulnerability** on https://github.com/Zivex-Software/zivex-skills/security/advisories/new

Include what you found, how to reproduce it, the version, and the impact you expect. We aim to acknowledge a report within 3 working days and to agree on a fix and disclosure timeline with you.

## Scope and design notes

`zivex-skills` is a local CLI. It reads and writes files in your repository and user directories, and it **never sends data anywhere** (no telemetry, no network calls except what your package manager does to install it).

- It writes only the files listed in the install summary, backs up user files before merging into them, and never overwrites a file you edited without `--force`.
- Hooks it installs are plain Node scripts in `content/hooks`; they run locally, read the hook input from the agent, and exit. They do nothing outside .NET repositories.
- Releases are published from GitHub Actions with npm provenance (trusted publishing); no long-lived npm token exists.

Examples of in-scope reports: a path traversal or overwrite outside the install targets, a hook that executes attacker-controlled input, a skill or script that leaks secrets, a workflow that can be abused to publish a malicious package.
