# AI agent instructions

Project guidance for AI coding agents:

| Tool | Hub |
|------|-----|
| **Cursor** | [`.cursor/CURSOR.md`](.cursor/CURSOR.md) |
| **Kiro** | [`.kiro/KIRO.md`](.kiro/KIRO.md) |
| **Claude Code** | [`.claude/CLAUDE.md`](.claude/CLAUDE.md) |
| **Antigravity** | [`GEMINI.md`](GEMINI.md) |

## Quick start (any tool)

1. Read **[`.agent/SESSION.md`](.agent/SESSION.md)** if it exists — run **`/resume`** to continue prior work
2. Open your tool's **hub** (table above) for workflow, rules, agents, and skills
3. Pick a **workflow command** for the current phase (`/spec`, `/plan`, `/build`, `/test`, `/review`, `/deploy`)
4. End with **`/handoff`** when switching chats or tools

## Per-tool invocation

| Tool | Hub | Workflow command | Persona |
|------|-----|------------------|---------|
| **Cursor** | `.cursor/CURSOR.md` | `@.cursor/commands/build.md` | `@.cursor/agents/backend.md` |
| **Claude Code** | `.claude/CLAUDE.md` | `/build` slash command | reference `.claude/agents/backend.md` |
| **Kiro** | `.kiro/KIRO.md` | `.kiro/commands/build.md` (paste or attach) | reference `.kiro/agents/backend.md` |
| **Antigravity** | `GEMINI.md` | `/build` workflow (`.agents/workflows/build.md`) | reference `.agents/agents/backend.md` |

## Layout

- **Cursor:** `.cursor/rules/` (`.mdc`), `.cursor/commands/`, `.cursor/mcp.json`
- **Kiro:** `.kiro/steering/` (`*.md`), `.kiro/commands/`, `.kiro/settings/mcp.json`
- **Claude Code:** `.claude/rules/`, `.claude/commands/`
- **Antigravity:** `.agents/workflows/`, `.agents/skills/`, `.agent/rules/`, `GEMINI.md` (MCP: user-level `~/.gemini/antigravity/mcp_config.json`)

**Cross-tool continuity:** committed [`.agent/SESSION.md`](.agent/README.md) — use `/resume` at session start and `/handoff` at session end (see hub docs and `.agent/README.md`).

## Code intelligence

- **CodeGraph MCP** (`codegraph_*`) — structural code search in chat; rules in each tool's `codegraph` rule file
- **OntoSight** (`npx @royalsolution/ontosight@0.2.0`) — interactive call-graph visualization in the browser; rules in each tool's `ontosight` rule file

## Maintainers

Keep **`.claude/`**, **`.cursor/`**, **`.kiro/`**, and the Antigravity layout in sync when you change workflows or standards. After editing **`.cursor/`** (canonical), run **`npm run sync:all`** to refresh `.claude/`, `.kiro/`, `.agents/`, `.agent/rules/`, and `GEMINI.md`. To refresh vendored Supabase skills from upstream, run **`npm run sync:supabase-skills`**.
