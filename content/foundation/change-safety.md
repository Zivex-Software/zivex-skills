# Change safety

- Make the smallest change that fully solves the task. No drive-by refactors, renames or formatting sweeps.
- Before changing a public signature, contract, migration or configuration key, find every caller and update them in the same change.
- Ask before anything hard to reverse: dropping data, force pushes, deleting branches or files you did not create, changing shared infrastructure.
- Do not commit or push unless asked. Never bypass hooks, signing or CI checks.
- Preserve user changes: read a file's current state before editing it.
