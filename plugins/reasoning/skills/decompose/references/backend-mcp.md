# Backend — external task manager over MCP

Writing the finalized subtasks to a task manager outside the repo — Linear, Jira, Notion, Trello, GitHub Issues, Height, whatever the session exposes. Use this when the work needs to be visible to people who don't have the repo: a PM, a designer, a manager.

This adapter is deliberately tool-agnostic. It does not assume any particular product. What it assumes is that the task manager is reachable through MCP tools present in this session, and that anything written there is **shared state** — visible to other people the moment it lands.

## Preflight

1. **Which MCP task-management tools are actually in this session?** Look at the tools available to you right now. Don't assume a connector exists because it's popular, and don't assume it's missing because you didn't see it a moment ago — check.

   - **None** → say so plainly, and offer Backlog.md or the Markdown fallback. Don't try to reach the service any other way: no scraping, no REST calls, no CLI guessing.
   - **Exactly one** → name it and confirm with the user before using it: *"I can see the Linear tools — writing these there?"*
   - **More than one** → ask **one** question with the options as they actually are: *"I can write these to Linear or to Notion — which one?"* Never pick for the user.

2. **Learn the tools before calling them.** You may not have used this connector before, and its schema is not something to recall from memory. Read the descriptions and parameters of the tools you're about to call. Expect the vocabulary to differ per product: project, board, team, space, repo, database, list. Map onto whatever this connector actually calls things.

3. **Where inside it?** Once the tool is chosen, ask **one** question about the container:

   > *"Which project should these go in — an existing one, or a new one for this work?"*

   - **Existing** → list the real candidates using the connector's list/search tool and let the user pick. Don't infer from a name that looks close enough.
   - **New** → confirm the name, and the team or workspace, before creating it. Creating a container is a visible organizational decision, not a tidiness step you take on the user's behalf.

4. **Assignee and due dates.** Only set them if the user brings them up. Assigning work to a named person is a social act, not a metadata field — don't guess it from git blame or from who's been touching the files.

## Writing

**Preview first, always.** Before anything is created, show the user exactly what will be written: the container, the number of tasks, and the titles. If the connector offers a dedicated preview or dry-run tool, use it. If it doesn't, write the preview yourself as a plain list in the chat. Get an explicit yes.

This is the rule that matters most in this adapter, and it is not a formality: writes to a shared board are visible to colleagues immediately and tedious to undo. A local board forgives a bad write; a shared one doesn't.

Once the preview is approved, create the tasks in dependency order, so a task that blocks another exists first.

Field mapping from the internal shape:

| Internal | Target |
| --- | --- |
| Title | task/issue name |
| Description | description or notes body |
| Acceptance criteria | a native checklist field if one exists; otherwise `- [ ]` items in the body under an **Acceptance criteria** heading |
| Dependencies | a real dependency/blocked-by relation if the connector exposes one; otherwise name the blocking task in the body |
| Open questions | body, under an **Open questions** heading — and a comment too if the connector supports comments, so it surfaces in the activity feed |

Most task managers have no first-class acceptance-criteria field. When there isn't one, keep the headings **exactly** consistent across every task in the set. That consistency is what makes the set readable to someone scanning the board later without this conversation.

**Subtasks vs siblings.** If the decomposition is one deliverable with steps, a parent task with subtasks reads better. If the pieces ship independently, they should be siblings. Ask which the user wants — it changes how the work appears in everyone else's views.

## Rules

- **Never write without an approved preview.** No exceptions, no matter how small the set.
- **Don't create projects, boards, or databases to "keep things tidy".** Those are the user's and their team's decisions.
- **Don't assign, don't set due dates, don't add followers or reviewers** unless the user asked.
- **Don't post status updates, don't @-mention, don't notify anyone.** Writing the tasks is the job; announcing them is the user's call.
- **Corrections go through the connector's update tool**, never by deleting and recreating — recreating loses comments and breaks links other people may already hold. Mention what changed in the report.
- **If a write fails halfway**, stop. Report which tasks landed and which didn't, with IDs. Don't retry the whole batch blindly and risk duplicates.

## Reporting

Give the container name, the task count, and links or IDs if the tools return them. Call out by name any task carrying an open question — on a shared board those are the ones that need a human owner before someone picks the task up cold.

## Both backends

If the user wants the work on a shared board *and* tracked in the repo, that's fine, but say the quiet part: two boards means two things to keep in sync, and nothing syncs them automatically. Suggest picking one as the source of truth and treating the other as a read-only mirror they refresh deliberately.
