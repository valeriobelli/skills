.PHONY: sync check validate test

prepare-repo:
	git config set core.hooksPath .githooks

# Unit tests for helper scripts bundled with skills.
test:
	node --test plugins/orchestration/skills/subagent-routing/evals/routing.test.mjs

# Full pre-commit gate: mirror in sync, then Claude + skill schema validation.
validate: check test
	claude plugin validate .
	npx skills@1.5.22 add . --list
