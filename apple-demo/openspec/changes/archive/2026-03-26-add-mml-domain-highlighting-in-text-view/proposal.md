## Why

The workbench now uses Monaco for text-class workspace files, including the text view of MML files, but MML content is still rendered as plain text. That leaves command-oriented files visually flat, makes comments harder to scan, and weakens the text view as a correction surface for telecom configuration work.

Users now need the MML text view to behave more like a domain editor rather than a generic text box. In particular, the editor must support syntax highlighting for core MML command structure and comment highlighting for the comment forms users actually write, including `/* ... */`, `// ...`, and `# ...`.

## What Changes

- Introduce a dedicated Monaco language configuration for MML text view instead of continuing to bind MML files to `plaintext`.
- Add domain-oriented lexical highlighting for MML command text, including command verbs, command objects, parameter keys, parameter values, delimiters, and statement terminators.
- Add comment highlighting support for block comments `/* ... */`, slash comments `// ...`, and hash comments `# ...` in MML text view.
- Keep the existing workbench shell and store-centered file model unchanged so tabs, save actions, continue-processing actions, dirty state, and file authority remain outside the editor engine.
- Preserve the current MML toolbar metadata behavior so only the standard leading header comment continues to drive `网元类型` and `网元版本`, while newly supported comment forms remain editor-level syntax only.
- Establish a stable language-layer foundation for later MML editor enhancements such as completion, hover, or diagnostics without requiring those capabilities in this change.

## Capabilities

### New Capabilities
<!-- None. -->

### Modified Capabilities
- `agent-web-workbench`: define a dedicated Monaco language for MML text view with domain-oriented syntax highlighting and broader comment highlighting, while preserving existing MML metadata and save behavior boundaries.

## Impact

- `apps/web` Monaco runtime integration, workspace text editor wiring, and related frontend tests.
- The MML text-view experience in the workspace editor, especially readability for command-heavy files and annotated review flows.
- The `agent-web-workbench` capability spec, which currently defines Monaco as the text engine for MML files but does not yet define MML-specific syntax highlighting behavior.
- No intended change to backend file APIs, workspace ownership, CSV behavior, or the save-time convergence contract for MML toolbar metadata.
