# Antigravity AI agent configuration

## Overview

This project uses **Google Antigravity** with the same structured workflows, specialized agent personas, and coding standards as **`.cursor/`**, **`.claude/`**, and **`.kiro/`**. Antigravity-specific files live under **`.agents/`**, **`.agent/rules/`**, and this hub (**`GEMINI.md`**).

Root **`AGENTS.md`** provides cross-tool rules read by Antigravity, Cursor, and Claude Code. **`GEMINI.md`** holds Antigravity-specific overrides and takes precedence over `AGENTS.md` when rules conflict.

---

## Development workflow

Follow this workflow for feature development:

```
/spec  →  /plan  →  /build  →  /test  →  /review  →  Ship
```

| Phase | Workflow | Purpose |
|-------|----------|---------|
| **Define** | `.agents/workflows/spec.md` (`/spec`) | PRD: objectives, scope, boundaries |
| **Plan** | `.agents/workflows/plan.md` (`/plan`) | Vertical slices, acceptance criteria |
| **Build** | `.agents/workflows/build.md` (`/build`) | Incremental implementation, TDD |
| **Verify** | `.agents/workflows/test.md` (`/test`) | Tests and verification |
| **Review** | `.agents/workflows/review.md` (`/review`) | Five-axis review before merge |
| **Ship** | `.agents/workflows/deploy.md` (`/deploy`) | Build, test, deploy |

### Supporting workflows

| File | Purpose |
|------|---------|
| `workflows/debug.md` (`/debug`) | Systematic diagnosis |
| `workflows/simplify.md` (`/simplify`) | Reduce complexity, same behavior |
| `workflows/fix-issue.md` (`/fix-issue`) | Analyze and fix reported issues |
| `workflows/handoff.md` (`/handoff`) | End session — update `.agent/SESSION.md` for cross-tool continuity |
| `workflows/resume.md` (`/resume`) | Start session — load `.agent/SESSION.md` and continue prior work |
| `workflows/publish-npm.md` | **Maintainers:** draft release notes, bump version, update README, publish to npm |

**How to use:** Type the slash command (e.g. `/build`) in Antigravity, or open the workflow file and paste/attach in chat.

---

## Core principles

- **TDD** — Failing tests first, then implementation (`.agents/skills/tdd/`)
- **Incremental implementation** — Small vertical slices (`.agents/skills/incremental-implementation/`)
- **Five-axis review** — Correctness, readability, architecture, security, performance (`.agents/skills/code-review/`)

---

## Mandatory standards (rules)

Project standards are **`.agent/rules/*.md`**. They use YAML frontmatter:

- **`trigger: always_on`** — Loaded every session (`antigravity-overview.md`, `security.md`, `codegraph.md`, `ontosight.md`, `agent-continuity.md`)
- **`trigger: glob`** — Loaded when active files match `globs`
- **`trigger: model_decision`** — Activated by intent (persona rules)

| Topic | Rule file |
|-------|-----------|
| Clean code, style, errors | `clean-code`, `code-style`, `error-handling` |
| Stack, structure, APIs | `tech-stack`, `project-structure`, `api-conventions` |
| Data & naming | `naming-conventions`, `database` |
| Ops & quality | `security`, `monitoring`, `testing`, `git-workflow`, `system-design` |
| Code intelligence | `codegraph` (MCP usage; see below) |
| Code visualization | `ontosight` (CLI; see below) |
| Agent continuity | `agent-continuity` (`.agent/SESSION.md` handoff) |

---

## Agent continuity

Cross-tool handoff lives in **`.agent/SESSION.md`** (committed). Use **`/resume`** at session start and **`/handoff`** at session end when switching chats or tools. See **`.agents/references/agent-continuity.md`** and **`.agent/rules/agent-continuity.md`**.

---

## Code intelligence (CodeGraph)

This project includes **[CodeGraph](https://github.com/colbymchenry/codegraph)** for local, structural code search via MCP.

| Item | Location |
|------|----------|
| MCP server config | `~/.gemini/antigravity/mcp_config.json` (user-level; see `.agents/references/mcp-antigravity.md`) |
| Usage rules | `.agent/rules/codegraph.md` |
| Symbol index (generated) | `.codegraph/` (gitignored) |
| Setup reference | `.agents/references/codegraph.md` |

After configuring MCP, **restart Antigravity** so the CodeGraph MCP server connects. Use `codegraph_*` tools for structural questions (callers, callees, traces, impact); use grep/read for literal text in comments or strings.

If the index is missing, run `npx @colbymchenry/codegraph init -i` in the project root.

---

## Code visualization (OntoSight)

This project includes **[OntoSight](https://www.npmjs.com/package/@royalsolution/ontosight)** for interactive CodeGraph call subgraphs in the browser.

| Item | Location |
|------|----------|
| Usage rules | `.agent/rules/ontosight.md` |
| Setup reference | `.agents/references/ontosight.md` |
| Shared index | `.codegraph/` (same as CodeGraph) |

Use `codegraph_*` MCP tools to gather structural facts in chat; run `npx @royalsolution/ontosight@0.2.0 .` when the user wants a visual call graph. For **impact analysis demos**, follow `skills/ui-ux-pro-max/IMPACT-DEMO.md` (search → `codegraph_impact` → summary → graph). Requires Node 20+, Python 3.11+, and uv or pipx.

---

## Agent personas

Instructions live in **`.agents/agents/`**. Invoke by **referencing** the file (paste or attach in chat).

| Area | File |
|------|------|
| Frontend, backend, architecture | `frontend.md`, `backend.md`, `systems-architect.md` |
| Quality | `code-reviewer.md`, `test-engineer.md`, `qa.md`, `security-auditor.md` |
| Product & content | `business-analyst.md`, `project-manager.md`, `ui-ux-designer.md`, `copywriter-seo.md` |

---

## Skills

Reusable playbooks: **`.agents/skills/*/SKILL.md`** (and related `.md` files where present).

| Skill | Use for |
|-------|---------|
| `tdd` | Red–green–refactor |
| `code-review` | Five-axis review |
| `incremental-implementation` | Vertical slices |
| `deploy` | Deployment pipeline |
| `security-review` | Security audit |
| `agent-continuity` | Cross-tool session handoff via `.agent/SESSION.md` |
| `supabase` | Supabase products, Auth, CLI, MCP, migrations, RLS |
| `supabase-postgres-best-practices` | Postgres performance, indexes, RLS tuning |

---

## Reference checklists

**`.agents/references/`**

| File | Use for |
|------|---------|
| `security-checklist.md` | Pre-deploy security |
| `testing-patterns.md` | Test structure |
| `performance-checklist.md` | Performance |
| `accessibility-checklist.md` | WCAG-oriented checks |
| `codegraph.md` | CodeGraph setup (all tools) |
| `ontosight.md` | OntoSight CLI for visual call graphs |
| `mcp-antigravity.md` | Antigravity MCP config (`mcp_config.json`) |
| `agent-continuity.md` | Session handoff and `/resume` / `/handoff` |
| `supabase.md` | Supabase skills, MCP OAuth, secrets |

---

## Config parity

Antigravity loads root **`AGENTS.md`**, **`GEMINI.md`**, **`.agent/rules/*.md`**, **`.agents/workflows/`**, and **`.agents/skills/`**. MCP servers are configured in user-level **`~/.gemini/antigravity/mcp_config.json`** — see `.agents/references/mcp-antigravity.md`.

---

## Agent behavior

1. Follow the workflow and use slash commands when starting a phase.
2. If **`.agent/SESSION.md`** exists, read it before planning or coding; run **`/resume`** when continuing prior work.
3. Apply **`.agent/rules/`**; treat **`security.md`** as non-negotiable.
4. Prefer tests first and small, buildable changes.
5. **Reference** the right **`.agents/agents/`** file when the task matches that role.
6. Update **`.agent/SESSION.md`** (or **`/handoff`**) before ending a session.
