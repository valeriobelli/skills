# Tools

How to find the session tier, how to turn a tier into a model, and how to write a pinned agent, for each tool.

## Tiers

`small` and `mid` are targets. The session's own model is `inherit`. A tier is only a target when it is below the session tier.

Claude family, lowest to highest:

| Family | Tier |
|---|---|
| haiku | small |
| sonnet | mid |
| opus | large |
| fable | large |

A model belongs to a family when its ID contains the family name.

## Claude Code

**Session tier.** Take the family of the session model from the table above. If the session model is not a Claude model, the tier is unknown.

**Setting the model.** The Agent tool's `model` parameter takes an alias only: `haiku`, `sonnet`, `opus` or `fable`.

| Tier | Alias |
|---|---|
| small | `haiku` |
| mid | `sonnet` |

**Limits.**

- When `CLAUDE_CODE_SUBAGENT_MODEL_FORCE` is set to `1`, you cannot pass a model. The target is inherit.
- An organisation allowlist may replace the model you chose. Claude Code shows its own warning. Do nothing extra.
- Claude Code has one provider. Ignore `candidates` and `restricted`.

## OpenCode

**Session tier.** If the session model is a Claude model, take its family from the table above. Otherwise, if `candidates` lists the session model under a tier, use that tier. Otherwise the tier is unknown. Compare references without the `#variant` part.

**Setting the model.** The subagent tool's `model` parameter takes `provider/model`, with an optional `#variant`. Take the reference from the model catalogue through the model lookup tool. Never write one from memory.

**With candidates** (`candidates` is not `null`). Take the list for the row's tier, in order. Use the first reference that passes both checks:

1. It is in the catalogue and its status is `active`.
2. Price guard: when the catalogue has an input price for both the session model and the candidate, the candidate's must be lower. When either price is missing, skip this check.

Pass the reference exactly as listed, variant included. If no reference passes, the target is inherit. The script has already removed the candidates that the project restriction excludes, so never add one yourself.

**No candidates** (`candidates` is `null`, or the script could not run). Stay on the session's provider. If the session model is a Claude model, look up the newest active model of the row's family on the same provider (`haiku` for small, `sonnet` for mid) and use it. For any other family, the target is inherit.

**Limit.** Models are enabled per project, so a reference that works in one repository can be missing in another. The catalogue check covers this.

## Other tools

Do not set a model and do not record. Say once per session that this tool cannot set a subagent's model, then spawn as usual.

## Promotion

Run this when `record` prints `"promote": true`.

**1. Choose the scope.**

| Condition | Scope |
|---|---|
| `shape.projects` has two or more entries | Global |
| `shape.projects` has one entry | Project |
| The model is on a provider other than the session's | Global, always |

For project scope, tell the user that the file will be tracked by git unless they exclude it.

**2. Choose the model.** Use the row's tier, resolved as above for your tool. If it cannot be resolved, leave the `model` field out.

**3. Write the draft.** Build the body from `shape.charters` and the prompt of the current batch. Keep what stays the same between runs. Leave out the inputs that change.

Claude Code — `.claude/agents/<shape>.md` (project) or `~/.claude/agents/<shape>.md` (global):

```markdown
---
name: <shape>
description: <one sentence: when to delegate to this agent>
tools: <see the tool list below>
model: <haiku|sonnet>
---

<charter, written as instructions to the agent>

Return evidence for every statement: a file path with line numbers, a direct quote, or the exact command output. If you cannot find evidence for something, say so. Do not guess.
```

Tool list by row:

| Row | `tools` |
|---|---|
| `locate`, `extract`, `checklist`, `charter-critic`, `explain` | `Read, Grep, Glob` |
| `run-and-report` | `Read, Grep, Glob, Bash` |
| `retrieve` | `Read, Grep, Glob, WebFetch, WebSearch` |

OpenCode — `.opencode/agents/<shape>.md` (project) or `~/.config/opencode/agents/<shape>.md` (global):

```markdown
---
description: <one sentence: when to delegate to this agent>
mode: subagent
model: <provider/model#variant>
permissions:
  - action: edit
    resource: "*"
    effect: deny
---

<charter, written as instructions to the agent>

Return evidence for every statement: a file path with line numbers, a direct quote, or the exact command output. If you cannot find evidence for something, say so. Do not guess.
```

**4. Show the draft** with its name, model, scope and target path. Wait for the user.

**5. After the answer.**

- Approved: write the file, then run `mark --status promoted`.
- Declined: run `mark --status declined`.
- A file already exists at the target path: do not overwrite it. Show it and ask for another name.

Both tools load a new agent file without a restart. One exception: in Claude Code, a session does not see an `agents` directory that did not exist when the session started. If you created the directory, tell the user to restart Claude Code.
