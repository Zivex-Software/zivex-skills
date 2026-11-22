# Data handling

- Treat production data and personal data as untrusted and sensitive. Never paste real customer data, tokens or connection strings into code, tests, fixtures, logs, commits or chat.
- Use synthetic data in tests and seeds. If the repo already has a seeding or test-data convention, follow it.
- Never log secrets or personal data. Log identifiers, not payloads.
- Do not run commands against a non-local database unless the user explicitly named that target in this conversation.
- Schema changes go through migrations that can be reviewed and rolled back; never edit a database by hand.
