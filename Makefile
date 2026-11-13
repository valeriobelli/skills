.PHONY: sync check validate test

prepare-repo:
	git config set core.hooksPath .githooks

# Unit tests for helper scripts bundled with skills. Node expands the glob, not the shell.
test:
	node --test "plugins/**/evals/*.test.mjs"

# Full pre-commit gate: script unit tests, then Claude + skill schema validation.
validate: check test
	claude plugin validate .
	npx skills@1.5.22 add . --list
