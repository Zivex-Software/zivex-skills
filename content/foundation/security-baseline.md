# Security baseline

- Validate all input at the boundary (HTTP, messages, files). Authorize every endpoint and every data access; check ownership/tenant on the server, never trust client-supplied ids.
- Use parameterized queries or the ORM; never build SQL, shell commands or file paths from user input.
- Keep secrets out of source and config files committed to git; use the secret store the repo already uses (user secrets, environment variables, vault).
- Return generic errors to clients; keep details in logs without secrets or personal data.
- Do not disable TLS validation, CORS restrictions, antiforgery or authorization checks to make something work.
- Add no dependency without a reason, and prefer well-maintained ones already used in the repo.
