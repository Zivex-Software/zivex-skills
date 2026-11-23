# Locating the owning module

Start from whatever the request names, and find the module that **defines** it. The module that merely uses it is a consumer.

## The script

```text
node scripts/module-context.mjs --find OrderCancelled --root .        # a type or message name
node scripts/module-context.mjs --find "/orders/{id}" --root .         # a route literal
node scripts/module-context.mjs --find orders --root . --json          # a table or schema name, for tooling
```

It reads the C# files (not comments), groups hits by module with role counts (implementation, contracts, test), and prints `defined at:` for lines that declare a class, record, struct, interface or enum with that name. The summary line names the owner: the single module that defines it, or the module with the most hits when nothing defines it (a route, a table or a string).

Words that are plain identifiers are matched as whole words; anything with punctuation (routes, `schema.table`) is matched as literal text.

## By kind of clue

| The request names    | Look for                                                                       | Then                                                                                                           |
| -------------------- | ------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| a type or DTO        | `--find TypeName`: the module with `defined at`                                | if it is defined in a `.Contracts` project, the owner is that module and every consumer is a blast-radius item |
| an endpoint or route | `--find "/segment"` and the `Map*` call                                        | the endpoint belongs to the module whose file maps it; the host only composes                                  |
| a table or column    | the `ToTable("...")` configuration, `--find tableName`                         | the module that configures the table owns it; other modules must not query it                                  |
| an event or message  | `--find EventName`: the module with `defined at` publishes, the others consume | the publisher owns the contract; consumers are listed with their handler files                                 |
| a configuration key  | the options class bound to that section, `--find SectionName`                  | each module has its own section; a key read by two modules is a smell                                          |
| a background job     | classes deriving from `BackgroundService` or named `*Worker`/`*Job`            | the job belongs to the module whose services it calls                                                          |
| a UI screen          | the generated API client call it makes, then the route                         | follow the route to its module                                                                                 |

## When there are several hits

- Defined in two modules with the same name: a name clash or a copied type. Say so; the contract-owning module wins, the copy is a boundary smell (`dotnet-module-boundary-check`).
- No definition found: it may be generated code, a string key or an external type. The module with most hits is a hint, not an answer: open one hit.
- Hits only in tests: the code was removed or lives outside this repository.
- Hits across many modules: it is probably a shared building block; check whether it belongs in a shared project and who owns that project.

## Confirm before relying on it

The result is text matching. Open the defining file, check its project (`module-context.mjs <path>` prints the module of a file), and read the module's `AGENTS.md` before you decide where a change goes.
