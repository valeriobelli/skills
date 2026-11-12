# Routing file

The routing file tells the skill which models it may use for each tier in OpenCode, including models on other providers. Claude Code talks to one provider at a time and does not use it.

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
    "mid": ["claude-agent/sonnet"],
    "large": ["github-copilot/gpt-6.1-sol"]
  },
  "sameProviderOnly": ["~/projects/work"]
}
```

| Field | Meaning |
|---|---|
| `version` | `1`. Optional. |
| `tiers` | Required. The only tier names are `small`, `mid` and `large`. Each is a list of model references. |
| `tiers.small`, `tiers.mid` | Targets, in order of preference. Each reference is `provider/model`, with an optional `#variant` such as `#low`. |
| `tiers.large` | Never a target. It lists models that count as large when one of them is the session model. Without it, a session on a model outside the Claude family has an unknown tier, and the skill leaves every subagent on the session model. |
| `sameProviderOnly` | Optional. Path prefixes. In a project under one of them, only references on the session's provider are candidates. `~` is the home directory. |

Rules the script enforces:

- A prefix must be an absolute path, or `~`, or start with `~/`.
- A reference must have the form `provider/model`, with no spaces.
- The only keys are `version`, `tiers` and `sameProviderOnly`, and the only tier names are `small`, `mid` and `large`. A misspelled name is an error, not something to ignore.
- If anything breaks these rules, the whole file is rejected. `context` then prints `"routesStatus": "invalid"`, the reason in `routesProblem`, and no candidates, and routing stays on the session's provider. A file that is only partly understood is never used, because a dropped restriction would send code to a provider the user excluded.
- The restriction is matched against the working directory. List every place a restricted repository is checked out, including worktrees outside the main folder.

The script cannot detect every mistake. A prefix for a folder that does not exist never matches, and when a key appears twice the last one wins. Write each prefix the way `pwd` prints the folder.

For a routing decision, do not read this file yourself. The `context` command reads it and prints `candidates`, with the references that `sameProviderOnly` excludes already removed.

## Setup

Run this only when the user asks ("set up subagent routing"). Do not offer it unprompted.

In Claude Code there is nothing to set up: say so and stop. The steps below are for OpenCode.

1. Read the model catalogue with the model lookup tool. List the providers that are available, with the session's provider first.
2. Ask which providers may receive code from the user's projects. Ask one question.
3. Ask whether any project must stay on the session's provider. Ask for every folder where such a project is checked out, worktrees included. Take the answer as path prefixes for `sameProviderOnly`.
4. Propose the file. For each tier, list references only from the providers the user named, taken from the catalogue. Put the session's provider first. Let the user decide which models outside the Claude family belong to which tier; do not rank them yourself.
5. If a reference you propose has a price of zero, say so. Free models often log prompts or train on them.
6. Show the proposed file. Write it only after the user approves.
7. Run `context --provider <session provider>` again. If `routesStatus` is not `ok`, show `routesProblem` and fix the file with the user. If the current project is one the user restricted, confirm that `restricted` is `true`.

Never add a provider the user did not name.

## Changing it

When the user asks to change the routing, show the current file, propose the edit, and write it after approval. Run `context --provider <session provider>` again afterwards, because the candidates have changed.

A new restriction, or a provider removed from `tiers`, does not change agents that are already pinned, and the tool can use a pinned agent without loading this skill. After adding a prefix, read the pinned agents in that project and in the global folder. If one names a model on another provider, tell the user and offer to remove its `model` line. After removing a provider, read the pinned agents in the current project and in the global folder. If one names a model on that provider, tell the user and offer to remove its `model` line.
