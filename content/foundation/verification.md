# Verification

- Do not say work is done until you have built it and run the tests that cover it, and have seen the output.
- If the repo has a verification command (script, Makefile, CI workflow), use that; otherwise `dotnet build` then `dotnet test` for the affected projects.
- Report what you ran and what you did not run. Failing or skipped checks are reported, never hidden.
- A bug fix starts with a failing test that reproduces it when that is practical.
