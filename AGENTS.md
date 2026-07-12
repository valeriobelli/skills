# Agent guide

This repo is a **source of agent skills**, not an application.

- Canonical skills live in `skills/<name>/SKILL.md` and follow the [Agent Skills open standard](https://agentskills.io) (`name` + `description` required frontmatter).
- Do **not** duplicate skills into per-tool directories — installers (`npx skills`, `gh skill`) and the Claude marketplace (`.claude-plugin/marketplace.json`) project the canonical tree into each tool's layout.
- To add a skill, copy `templates/skill-template/` and register it in a `marketplace.json` bundle. See [CONTRIBUTING.md](CONTRIBUTING.md).
- Before committing, run `claude plugin validate .` and `npx skills add . --list`.
