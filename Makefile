.PHONY: sync check validate

prepare-repo:
	git config set core.hooksPath .githooks

# Full pre-commit gate: mirror in sync, then Claude + skill schema validation.
validate: check
	claude plugin validate .
	npx skills@1.5.22 add . --list
