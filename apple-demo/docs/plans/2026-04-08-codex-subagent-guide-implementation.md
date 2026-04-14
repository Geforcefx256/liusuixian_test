# Codex Subagent Guide Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a single-file HTML guide that explains Codex subagent concepts, APIs, workflows, and advanced usage patterns in Chinese.

**Architecture:** The document is a standalone static page under `docs/`, with inline CSS and semantic sections. The page uses anchored navigation, styled callouts, code examples, and CSS-based flow diagrams to balance tutorial readability with quick lookup utility.

**Tech Stack:** HTML5, inline CSS, static content authoring

---

### Task 1: Define the documentation artifacts

**Files:**
- Create: `docs/plans/2026-04-08-codex-subagent-guide-design.md`
- Create: `docs/plans/2026-04-08-codex-subagent-guide-implementation.md`
- Create: `docs/codex-subagent-guide.html`

- [ ] **Step 1: Write the design summary**

Write a short design document that fixes the audience, structure, and output target:

```md
# Codex Subagent Guide Design

## Goal
Create a single-file HTML guide in Chinese that teaches users how to understand, create, operate, and scale `subagent` usage in Codex from beginner to advanced level.

## Audience
- New users
- Intermediate users
- Advanced users
```

- [ ] **Step 2: Create the implementation plan**

Write this plan file with the exact target path and task structure so execution stays scoped to a single HTML page plus companion notes.

- [ ] **Step 3: Confirm the files exist**

Run: `Get-ChildItem docs\\plans, docs | Select-Object FullName`
Expected: the design doc, implementation plan, and `docs/codex-subagent-guide.html` appear in the output

- [ ] **Step 4: Commit**

```bash
git add docs/plans/2026-04-08-codex-subagent-guide-design.md docs/plans/2026-04-08-codex-subagent-guide-implementation.md docs/codex-subagent-guide.html
git commit -m "docs: add codex subagent usage guide"
```

### Task 2: Build the standalone HTML structure

**Files:**
- Modify: `docs/codex-subagent-guide.html`

- [ ] **Step 1: Write the base document shell**

Create the document shell with metadata, a page title, a hero section, and anchored navigation:

```html
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Codex Subagent 使用指南</title>
  </head>
  <body>
    <header>
      <h1>Codex Subagent 使用指南</h1>
      <nav>
        <a href="#intro">概览</a>
        <a href="#apis">核心 API</a>
        <a href="#advanced">高阶用法</a>
      </nav>
    </header>
  </body>
</html>
```

- [ ] **Step 2: Add inline styling**

Add inline CSS for navigation, cards, callouts, code blocks, tables, and simple flow diagrams:

```html
<style>
  :root {
    --bg: #f5efe2;
    --paper: #fffdf8;
    --ink: #1f1c18;
    --accent: #0b6e4f;
  }
</style>
```

- [ ] **Step 3: Add semantic content sections**

Add sections for:

- what subagents are
- when to use them
- core lifecycle
- `spawn_agent`, `send_input`, `wait_agent`, `close_agent`
- advanced patterns
- anti-patterns
- checklist

- [ ] **Step 4: Commit**

```bash
git add docs/codex-subagent-guide.html
git commit -m "docs: scaffold codex subagent guide page"
```

### Task 3: Add concrete examples and operational guidance

**Files:**
- Modify: `docs/codex-subagent-guide.html`

- [ ] **Step 1: Add API examples**

Include example snippets for `spawn_agent`, `send_input`, `wait_agent`, and `close_agent`:

```json
{
  "agent_type": "worker",
  "message": "Implement the login form validation in apps/web/src/components/LoginForm.vue",
  "model": "gpt-5.3-codex",
  "reasoning_effort": "medium"
}
```

- [ ] **Step 2: Add workflow diagrams**

Show a minimal lifecycle and a parallel delegation pattern using HTML sections and arrow markers:

```html
<div class="flow">
  <div class="node">主代理分析任务</div>
  <div class="arrow">→</div>
  <div class="node">创建 subagent</div>
  <div class="arrow">→</div>
  <div class="node">本地继续推进</div>
</div>
```

- [ ] **Step 3: Add advanced rules and anti-patterns**

Explicitly document:

- do local blocking work first
- delegate sidecar work
- keep write ownership disjoint
- do not wait by reflex
- reuse existing agents when context matters
- close agents when done

- [ ] **Step 4: Commit**

```bash
git add docs/codex-subagent-guide.html
git commit -m "docs: add subagent workflows and advanced usage"
```

### Task 4: Verify readability and content coverage

**Files:**
- Modify: `docs/codex-subagent-guide.html`

- [ ] **Step 1: Review the HTML for missing sections**

Check that the page explicitly covers:

- creation
- usage
- advanced strategies
- common mistakes
- best practices

- [ ] **Step 2: Run a quick content search**

Run: `rg -n "spawn_agent|send_input|wait_agent|close_agent|高阶|误区|最佳实践" docs/codex-subagent-guide.html`
Expected: each keyword appears at least once

- [ ] **Step 3: Open the file mentally as a standalone page**

Confirm the page does not depend on JavaScript, external CSS, fonts, or images, and that all sections remain understandable when opened directly from the filesystem.

- [ ] **Step 4: Commit**

```bash
git add docs/codex-subagent-guide.html
git commit -m "docs: finalize codex subagent guide"
```
