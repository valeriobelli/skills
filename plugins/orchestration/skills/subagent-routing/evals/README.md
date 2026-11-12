# Evals

Two kinds of test live here.

## Unit tests

`routing.test.mjs` tests `scripts/routing.mjs`. From the repository root:

```bash
make test
```

Each test uses its own temporary directories, so it never touches your real ledger or routing file.

## Behaviour evals

`evals.json` holds the cases, in the format the `skill-creator` skill reads. They check what the agent does, so they need a real session.

Run them in a session that points the script at scratch directories. Without this, the eval runs write to your real ledger and can trigger a real promotion.

```bash
SCRATCH=$(mktemp -d)
cp -R plugins/orchestration/skills/subagent-routing/evals/files/state "$SCRATCH/state"
mkdir "$SCRATCH/config"

# Claude Code
SUBAGENT_ROUTING_STATE_DIR="$SCRATCH/state" SUBAGENT_ROUTING_CONFIG_DIR="$SCRATCH/config" claude

# OpenCode: --standalone gives the session its own server, so the variables reach the shell tool
SUBAGENT_ROUTING_STATE_DIR="$SCRATCH/state" SUBAGENT_ROUTING_CONFIG_DIR="$SCRATCH/config" opencode --standalone
```

Both variables must hold absolute paths; the script refuses relative ones. Do not use `XDG_CONFIG_HOME` for this. It would also move the tool's own configuration.

In that session, load `skill-creator` and ask it to run the evals for `subagent-routing`.

| Evals | State directory | Config directory |
|---|---|---|
| 1 to 6 | A copy of `files/state` | Empty |
| 7 | A copy of `files/state` | A copy of `files/config` |

Eval 7 needs its own session, because its routing file names a model that does not exist and would change the result of evals 1 and 2 in OpenCode.

`files/state/ledger.jsonl` holds one shape, `skill-frontmatter-check`, with three batches on two days in two projects. That already meets the promotion threshold, so the next `record` for that shape returns `"promote": true`. Eval 6 checks what the agent does with it.
