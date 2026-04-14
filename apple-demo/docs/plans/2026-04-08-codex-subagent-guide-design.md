# Codex Subagent Guide Design

## Goal

Create a single-file HTML guide in Chinese that teaches users how to understand, create, operate, and scale `subagent` usage in Codex from beginner to advanced level.

## Audience

- New users who need a clear mental model of what a subagent is
- Intermediate users who want a reliable operational workflow
- Advanced users who need delegation strategy, ownership rules, and anti-pattern guidance

## Chosen Format

A tutorial-style single-page HTML document with quick-reference elements embedded into each section.

This combines:

- The onboarding clarity of a tutorial
- The practicality of a command/API cheatsheet
- The realism of scenario-driven guidance

## Information Architecture

1. What a subagent is
2. When to use and when not to use a subagent
3. Core lifecycle and mental model
4. How to create a subagent with `spawn_agent`
5. How to collaborate with `send_input`, `wait_agent`, and `close_agent`
6. Advanced patterns:
   - critical path vs sidecar task
   - parallel delegation
   - disjoint file ownership
   - agent reuse
   - interruption and reprioritization
7. Common mistakes
8. Best-practice checklist

## Visual Direction

- Pure static HTML with inline CSS
- No external dependencies
- Documentation-first tone instead of marketing tone
- Strong information hierarchy with anchored navigation
- Flow diagrams built with semantic HTML and CSS boxes instead of images

## Content Principles

- Explain each tool in one sentence before showing examples
- Prefer concrete examples over abstract guidance
- Tie advanced rules back to operational consequences
- Include environment-specific constraints, especially:
  - `spawn_agent` only when the user explicitly asks for subagents, delegation, or parallel work
  - delegate only well-scoped, non-overlapping work
  - avoid blocking the main thread by waiting reflexively

## Output File

- `docs/codex-subagent-guide.html`

## Review Checklist

- Covers beginner, intermediate, and advanced readers in one page
- Explains creation, usage, and advanced patterns explicitly
- Uses Chinese throughout
- Can be opened directly in a browser without build steps
