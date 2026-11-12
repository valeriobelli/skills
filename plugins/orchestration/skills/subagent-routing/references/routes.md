# Routing file

The routing file tells the skill which models it may use for each tier in OpenCode, including models on other providers. Claude Code has one provider and does not use it.

The user owns this file. Write it only during setup, and only after they approve the content.

## Location

`$XDG_CONFIG_HOME/subagent-routing/routes.json`, by default `~/.config/subagent-routing/routes.json`. The `SUBAGENT_ROUTING_CONFIG_DIR` variable, when set, names the directory that holds `routes.json`.

It is outside the skill folder so that a skill update never replaces it.

## Format

```json
{
  "version": 1,
  "tiers": {
    "small": ["claude-agent/haiku", "github-copilot/claude-haiku-5.5"],
    "mid": ["claude-agent/sonnet"]
  },
  "sameProviderOnly": ["~/projects/work"]
}
```

| Field | Meaning |
|---|---|
| `version` | Always `1`. |
| `tiers.small`, `tiers.mid` | Model references in order of preference. Each is `provider/model`, with an optional `#variant` such as `#low`. |
| `sameProviderOnly` | Path prefixes. In a project under one of them, only references on the session's provider are candidates. `~` is the home directory. |

Rules the script enforces:

- A prefix must be an absolute path or start with `~/`.
- A reference must have the form `provider/model`.
- The only keys are `version`, `tiers` and `sameProviderOnly`. A misspelled key is an error, not something to ignore.
- If anything breaks these rules, the whole file is rejected. `context` then prints `"routesStatus": "invalid"`, the reason in `routesProblem`, and no candidates, and routing stays on the session's provider. A file that is only partly understood is never used, because a dropped restriction would send code to a provider the user excluded.
- The restriction is matched against the working directory. List every place a restricted repository is checked out, including worktrees outside the main folder.

The script cannot detect every mistake. A prefix for a folder that does not exist never matches, and when a key appears twice the last one wins. Write each prefix the way `pwd` prints the folder.

For a routing decision, do not read this file yourself. The `context` command reads it and prints `candidates`, with the references that `sameProviderOnly` excludes already removed.

## Setup

Run this only when the user asks ("set up subagent routing"). Do not offer it unprompted.

1. Read the model catalogue with the model lookup tool. List the providers that are available, with the session's provider first.
2. Ask which providers may receive code from the user's projects. Ask one question.
3. Ask whether any project must stay on the session's provider. Take the answer as path prefixes for `sameProviderOnly`.
4. Propose the file. For each tier, list references only from the providers the user named, taken from the catalogue. Put the session's provider first.
5. If a reference you propose has a price of zero, say so. Free models often log prompts or train on them.
6. Show the proposed file. Write it only after the user approves.
7. Run `context` again. If `routesStatus` is not `ok`, show `routesProblem` and fix the file with the user. If the current project is one the user restricted, confirm that `restricted` is `true`.

Never add a provider the user did not name.

## Changing it

When the user asks to change the routing, show the current file, propose the edit, and write it after approval. Run `context` again afterwards, because the candidates have changed.
