# Rubric

A row is a class of task with a lowest safe tier. A task that fits a row may run on that tier. A task that fits no row keeps the session model.

A small model is safe on these rows for one reason: the output carries its own evidence, so the main thread can check it cheaply. A row stops being safe the moment the subagent has to judge, design or decide.

## Rows

### `locate` — small

Find files, symbols or usages, and return paths and line numbers.

- Fits: "List every file that imports `formatPrice`, with line numbers."
- Does not fit: "Find the usages of `formatPrice` and decide which ones are unsafe." The deciding is outside the row.

### `extract` — small

Pull stated facts from named files into a fixed format.

- Fits: "For each `package.json` under `apps/`, return the name, the version and the `engines` field as a table."
- Does not fit: "Read the packages and tell me which dependencies we should drop."

### `checklist` — small

Check named items against an explicit list of yes/no questions, with evidence for each answer.

- Fits: "For this migration file, answer: does it add a NOT NULL column without a default? Does it create an index without CONCURRENTLY? Quote the line for each yes."
- Does not fit: "Review this migration for problems." There is no list, so the subagent has to decide what matters.

### `run-and-report` — small

Run a given command and return the output and pass or fail. No diagnosis.

- Fits: "Run `npm test -- --run` in `packages/api` and return the failing test names with their error messages."
- Does not fit: "Run the tests and find out why they fail."

### `retrieve` — small

Fetch a page or document and return the relevant passages as quotes.

- Fits: "Fetch the changelog at this URL and quote every entry that mentions `parseArgs`."
- Does not fit: "Read the changelog and tell me whether we can upgrade."

### `charter-critic` — mid

Review something against a written charter that names what to look for and how, with evidence only.

- Fits: a `council` critic with a role charter and an evidence-only rule.
- Does not fit: "Review this plan." There is no charter.

### `explain` — mid

Read several files and explain how something works, with file references.

- Fits: "Explain how a request gets from the router to the database in `services/orders`, with file and line references."
- Does not fit: "Explain why checkout is slow." That is a diagnosis.

## Never downgrade

These keep the session model, whatever else is true:

- writing or changing code;
- finding the root cause of a bug;
- design or architecture judgement;
- security review;
- combining or judging the output of other subagents;
- any task whose output will be acted on without a check.

## Full and partial matches

- **Full match:** the whole task fits one row.
- **Partial match:** the task fits a row, and also contains work outside the row or an item from the never-downgrade list. "Find the usages and judge which are unsafe" is a partial match for `locate`.

When you cannot tell whether a match is full or partial, treat it as partial.

## Evidence clause

End the prompt of every subagent that runs on a chosen model with this text:

```
Return evidence for every statement: a file path with line numbers, a direct quote, or the exact command output. If you cannot find evidence for something, say so. Do not guess.
```

## Naming a shape

A shape is one recurring delegation inside a row. The ledger counts shapes, and a pinned agent is created per shape.

- Reuse a name printed by `context` when its charter describes this delegation. This is what makes the counts add up across sessions.
- Use the row name (`locate`, `extract`) for a one-off delegation with no identity of its own.
- Give a new name when the delegation has a fixed charter that will be reused with different inputs. Name the job, not the input: `sql-migration-check`, not `check-orders-migration`.
- Names are kebab-case: lowercase letters, digits and hyphens.

## Writing the charter

The charter is one line that says what this shape does, in general terms. It is the only description of the work that is stored.

- At most 200 characters.
- No file paths, no identifiers, no text from the project.
- Good: `Check a database migration against the locking checklist and quote the offending lines`.
- Bad: `Check db/migrate/20261101_add_orders_idx.rb for the orders index problem from last week`.
