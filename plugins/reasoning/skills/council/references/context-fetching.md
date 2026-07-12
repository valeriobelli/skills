# Context fetching

When the user passes a URL or file path to `/council`, the skill must fetch the underlying context before launching the council. This file lists the URL patterns to detect and the tools that should be tried (in preference order).

## General approach

1. Match the input against the patterns below in **precedence order**:
   1. **Local file path** wins first — if the input starts with `/`, `~`, `./`, or resolves via `Read`, treat as file *even if it looks like it contains URL-like text inside*. Edge case: a path like `~/notes/asana-link.md` is a file, not Asana.
   2. **URL scheme + host match** — `https?://` followed by a host pattern below.
   3. **Plain text** — everything else.
2. Try the *first* tool that's available in the current environment for the matched type.
3. If no listed tool is available, fall back to asking the user to paste the relevant content. Don't silently proceed with just the URL — the council needs the actual content.
4. After fetching, summarize what you got back in 1–2 lines before proposing the council (so the user can correct if context was wrong).

### URL regex hints (for precise matching)

Use these to disambiguate hosts. The first matching pattern wins.

| Host pattern (regex) | Type |
|---|---|
| `^https?://github\.com/[^/]+/[^/]+/pull/\d+` | GitHub PR |
| `^https?://github\.com/[^/]+/[^/]+/issues/\d+` | GitHub Issue |
| `^https?://github\.com/[^/]+/[^/]+/commit/[a-f0-9]+` | GitHub Commit |
| `^https?://github\.com/[^/]+/[^/]+/blob/` | GitHub File |
| `^https?://github\.com/[^/]+/[^/]+/?$` | GitHub Repo |
| `^https?://app\.asana\.com/0/\d+/\d+` | Asana Task |
| `^https?://[^/]+\.notion\.so/` or `^https?://www\.notion\.so/` | Notion Page |
| `^https?://(www\.)?figma\.com/(design|file|board)/` | Figma File |
| `^https?://docs\.google\.com/(document\|spreadsheets\|presentation)/d/` | Google Docs |
| `^https?://drive\.google\.com/file/d/` | Google Drive File |
| `^https?://[^/]+\.slack\.com/archives/` | Slack Message |
| `^https?://` (any other) | Generic — try WebFetch |

## URL pattern → tool mapping

### GitHub (github.com)

Patterns:
- `github.com/<owner>/<repo>/pull/<n>` — pull request
- `github.com/<owner>/<repo>/issues/<n>` — issue
- `github.com/<owner>/<repo>/commit/<sha>` — commit
- `github.com/<owner>/<repo>/blob/...` — file at ref
- `github.com/<owner>/<repo>` (root) — repo overview

Tools to try (in order):
1. `mcp__GitHub__*` MCP tools (e.g., `pull_request_read`, `issue_read`, `get_file_contents`)
2. `gh` CLI via Bash: `gh pr view <n>`, `gh issue view <n>`, `gh api ...`
3. WebFetch on the URL (last resort — public repos only, no comments)

### Asana (app.asana.com)

Patterns:
- `app.asana.com/0/<project>/<task>` or `app.asana.com/0/<project>/<task>/f` — task
- `app.asana.com/0/<project>/list` — project board

Tools to try:
1. `mcp__Asana__get_task` (extract task GID from URL) or `mcp__claude_ai_Asana__get_task`
2. `mcp__Asana__search_tasks` for fuzzy lookup if direct fetch fails
3. WebFetch (won't work — Asana requires auth)
4. Ask user to paste

### Notion (notion.so)

Patterns:
- `notion.so/<workspace>/<page-slug-with-id>` — page
- `notion.so/<id>` — page by id

Tools to try:
1. `mcp__claude_ai_Notion__notion-fetch` with the URL
2. `mcp__claude_ai_Notion__notion-search` for keyword fallback
3. Ask user to paste

### Figma (figma.com)

Patterns:
- `figma.com/design/<fileKey>/<name>?node-id=<nodeId>` — specific node
- `figma.com/design/<fileKey>/...` — file
- `figma.com/file/<fileKey>/...` (legacy) — file
- `figma.com/board/<fileKey>/...` — FigJam board

Tools to try:
1. `mcp__claude_ai_Figma__get_design_context` for design files
2. `mcp__claude_ai_Figma__get_figjam` for FigJam boards
3. `mcp__claude_ai_Figma__get_screenshot` if visual context is needed
4. Ask user to paste / describe

Note: extract `fileKey` and `nodeId` from URL; for `node-id` convert `-` to `:` per Figma URL parsing rules.

### Google Drive / Docs / Sheets

Patterns:
- `docs.google.com/document/d/<id>`
- `docs.google.com/spreadsheets/d/<id>`
- `drive.google.com/file/d/<id>`

Tools to try:
1. `mcp__claude_ai_Google_Drive__read_file_content` or `get_file_metadata`
2. WebFetch (won't work for private docs)
3. Ask user to paste / export

### Slack

Patterns:
- `*.slack.com/archives/<channel>/p<ts>` — message link

Slack MCP typically requires auth. If unavailable, ask user to paste the message + thread context.

### Plain HTTP(S) URLs (other)

For anything not matching above:
- Try `WebFetch` — works for public pages.
- If it returns auth-walls or empty, ask the user to paste.

## Local file paths

If the input looks like a path (starts with `/`, `~`, `./`, or is a relative path that resolves), try `Read`. If the file doesn't exist, treat it as text.

## Plain text

If the input is neither a URL nor a path, treat it as the context itself. If it's very thin (under ~30 words), ask one targeted clarifying question before committing the council. Useful clarifications: deadline, constraints, prior attempts, stakes.

## After fetching

Always summarize the fetched context in your message before proposing the council:

> Fetched the GitHub issue (#412, "Migrate ingestion off Postgres"). 14 comments, last activity 2 days ago. Summary: <2-3 lines>. Council composition: …

This gives the user a chance to flag if the wrong thing was fetched.
