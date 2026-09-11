# Backend — Backlog.md

Writing the finalized subtasks to a local [Backlog.md](https://github.com/MrLesk/Backlog.md) board. Tasks become plain Markdown files inside the repo, versioned in Git alongside the code.

## Preflight

1. **Is the CLI available?** `backlog --version`.
   - Not installed → tell the user: `npm i -g backlog.md` (or `brew install backlog-md`, or `bun add -g backlog.md`). Don't install it yourself without asking.
   - One-off runs need the full package name: `npx backlog.md <cmd>`. Plain `npx backlog` resolves to an unrelated package.

2. **Is the project initialized?** Look for `backlog/`, `.backlog/`, or a `backlog_directory` key in `backlog.config.yml`.
   - Not initialized → ask before running `backlog init "<project name>"`. It's an interactive wizard that writes config and offers to wire up agent instructions, so let the user run it themselves if they'd rather.

3. **Confirm the flags before using them.** Run `backlog task create --help` and check the flags you're about to pass actually exist in the installed version. The CLI moves; don't write from memory. Full reference: `backlog instructions overview`, or `CLI-INSTRUCTIONS.md` in the Backlog.md repo.

4. **Note the ID prefix.** Default IDs look like `TASK-1`; a project initialized with `--task-prefix` uses its own (e.g. `BACK-1`). Read it from the config rather than assuming, so the IDs you report back are real.

## Writing

Create tasks in dependency order — a task that others depend on gets created first, so its ID exists when you reference it.

```bash
backlog task create "Extract rate limiter into a shared package" \
  -d "The limiter currently lives in apps/web/src/middleware. Move it to packages/rate-limit so the API service can consume it without importing web code." \
  --ac "packages/rate-limit exports createRateLimiter" \
  --ac "apps/web imports from packages/rate-limit, no local copy remains" \
  --ac "rate_limiter_burst_test passes"
```

Field mapping from the internal shape:

| Internal | Backlog.md |
| --- | --- |
| Title | the positional argument |
| Description | `-d` |
| Acceptance criteria | one `--ac` per criterion |
| Dependencies | the dependency flag — confirm its exact name via `--help` |
| Open questions | append to the description, under an `## Open questions` heading |

**Definition of Done.** The project may have DoD defaults configured that get added to every task automatically. Don't duplicate them as acceptance criteria — check `backlog.config.yml` for a `definition_of_done` key first. Per-task additions go via `--dod`.

**Milestones.** If the decomposition is one coherent effort, `backlog milestone add` and grouping the tasks under it makes the board readable. Ask before creating one — it's a structural choice, not a detail.

## Rules

- **Use the CLI, never hand-edit the task files.** Field types and metadata stay consistent only if the CLI writes them.
- **Don't commit.** The task files land in the working tree; leave the commit to the user unless they ask. If the project has `autoCommit` enabled in its config, say so in the report so they're not surprised.
- **Corrections go through `backlog task edit <ID>`**, not by editing Markdown.

## Verifying and reporting

```bash
backlog task list --json    # machine-readable, confirm everything landed
backlog board               # terminal kanban
```

Report the real IDs returned by the CLI, not IDs you predicted. Then point at one of:

- `backlog board` — kanban in the terminal
- `backlog browser` — local web UI with drag-and-drop, `127.0.0.1` only

## Fallback

If the CLI can't be installed and the user doesn't want an external board either, write the set to a Markdown file in the repo (one `##` section per task, criteria as checkboxes) and tell them the path. The interrogation is the valuable part — don't lose it over a missing binary.
