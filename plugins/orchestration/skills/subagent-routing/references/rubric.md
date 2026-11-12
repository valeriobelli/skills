# Rubric

A row is a class of task with a lowest safe tier. A task that fits a row may run on that tier. A task that fits no row keeps the session model.

A smaller model is safe on these rows for one reason: the output carries its own evidence, so the main thread can check it cheaply. A row stops being safe the moment the subagent has to judge, design or decide.

Evidence shows what was found. It does not show what was missed. Before you act on a list being complete, or on an empty result, check it yourself.

## Rows

### `locate` — small

Find a named symbol, string or pattern, and return paths and line numbers.

- Fits: "List every file that imports `formatPrice`, with line numbers."
- Does not fit: "Find where rate limiting is implemented." Deciding what counts as rate limiting is a judgement.
- Does not fit: "Find the usages of `formatPrice` and decide which ones are unsafe." The deciding is a security review.

### `extract` — small

Pull stated facts from named files into a fixed format.

- Fits: "For each `package.json` under `apps/`, return the name, the version and the `engines` field as a table."
- Does not fit: "Read the packages and tell me which dependencies we should drop."

### `checklist` — small

Check named items against an explicit list of yes/no questions, with evidence for each answer. Each question must be answerable by pointing at a line: a stated pattern is present or it is absent.

- Fits: "For this migration file, answer: does it add a NOT NULL column without a default? Does it create an index without CONCURRENTLY? Quote the line for each yes."
- Does not fit: "Review this migration for problems." There is no list, so the subagent has to decide what matters.
- Does not fit: "Does this function handle every error case?" It is a yes/no question in form and a judgement in substance.

### `run-and-report` — small

Run a given command and return the output and pass or fail. No diagnosis.

- Fits: "Run `npm test -- --run` in `packages/api` and return the failing test names with their error messages."
- Does not fit: "Run the tests and find out why they fail."

### `retrieve` — small

Fetch a page or document and return the relevant passages as quotes.

- Fits: "Fetch the changelog at this URL and quote every entry that mentions `parseArgs`."
- Does not fit: "Read the changelog and tell me whether we can upgrade."

### `charter-critic` — mid

Review something against a written charter that names what to look for and how to prove it, with evidence only. The main thread weighs the result.

- Fits: a `council` critic with a simplicity, performance or test-coverage charter and an evidence-only rule.
- Does not fit: "Review this plan." There is no charter.
- Does not fit: a critic whose charter is a security review or a root-cause diagnosis. Both are on the never-downgrade list.

### `explain` — mid

Read several files and explain how something works, with file references.

- Fits: "Explain how a request gets from the router to the database in `services/orders`, with file and line references."
- Does not fit: "Explain why checkout is slow." That is a diagnosis.

## Never downgrade

A task that contains any of these keeps the session model. It is not a match of any kind. Do not propose a cheaper tier for it, and do not ask.

- writing or changing code;
- finding the root cause of a bug;
- making a design or architecture decision;
- security review;
- combining or judging the output of other subagents;
- any task where you will act on a list being complete, or on an empty result, without checking it yourself.

## Matching

- **Full match:** the whole task fits one row.
- **Several rows:** a task made only of rows is a full match. It takes the highest tier among them, and that row is the one you record. When the tiers are equal, record the row that comes first in this file. "Find every `package.json` and return its `engines` field" is `locate` plus `extract`: small, recorded as `locate`.
- **Partial match:** the task fits a row, and also contains work that is outside every row and is not on the never-downgrade list. "List every TODO comment and group them by theme" is a partial match for `extract`: the grouping is outside the row.
- **No match:** everything else, including every task that contains a never-downgrade item.

When you cannot tell whether a match is full or partial, treat it as partial. When you cannot tell whether it is a match at all, it is not one.

## Evidence clause

End the prompt of every subagent that runs on a chosen model with this text:

```
Return evidence for every statement: a file path with line numbers, a direct quote, or the exact command output. List the exact searches and commands you ran. If you cannot find evidence for something, say so. Do not guess. Do not change any file. If the task needs a judgement or a fix, say so and stop.
```

For a partial match that the user approved, leave out the last sentence. The part outside the row is then wanted.

## Naming a shape

A shape is one recurring delegation inside a row. The ledger counts shapes, and a pinned agent is created per shape.

- Reuse a name printed by `context` when its charter describes this delegation and its row is the same. This is what makes the counts add up across sessions.
- Use the row name (`locate`, `extract`) for a one-off delegation with no identity of its own. A shape named after its row is never proposed for promotion, because its batches have nothing in common.
- Give a new name when the delegation has a fixed charter that will be reused with different inputs. Name the job, not the input: `sql-migration-check`, not `check-orders-migration`.
- Names are kebab-case: lowercase letters, digits and hyphens.
- Do not use the name of an agent that already exists, built in or custom. A pinned agent takes the shape's name and would replace it. In particular, never use `explore`, `general`, `general-purpose`, `plan`, `build` or `claude`.

## Writing the charter

The charter is one line that says what this shape does, in general terms. It is the only description of the work that is stored.

- At most 200 characters.
- No file paths, no identifiers, no text from the project.
- Good: `Check a database migration against the locking checklist and quote the offending lines`.
- Bad: `Check db/migrate/20261101_add_orders_idx.rb for the orders index problem from last week`.
