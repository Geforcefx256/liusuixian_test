## 1. MML Monaco Language Layer

- [x] 1.1 Refine the dedicated Monaco language registration for MML text view so its tokenizer model treats the full command head before `:` as one command name rather than separate verb and object tokens.
- [x] 1.2 Refine the Monarch tokenizer for MML so it highlights command names and parameter identifiers as the primary MML signal, while preserving assignment operators, value forms, delimiters, and statement terminators.
- [x] 1.3 Add editor-level support for MML comment highlighting across `/* ... */`, `// ...`, and supported `# ...` comment forms without expanding business metadata parsing semantics.

## 2. Workspace Text Editor Integration

- [x] 2.1 Update the workspace Monaco text adapter so `mml` files bind to the dedicated MML language id while plain-text files continue to use `plaintext`.
- [x] 2.2 Preserve the current workbench shell, toolbar ownership, dirty-state behavior, and save-time convergence flow while refining MML tokenization to support empty command bodies and multiple statements per line.
- [x] 2.3 Preserve the existing rule that only the standard leading MML header comment drives `网元类型` and `网元版本`, even though broader comment forms are highlighted in the editor.

## 3. Verification

- [x] 3.1 Update workspace text editor tests to cover MML language binding, language switching, and the removal of the old `plaintext` assumption for MML files.
- [x] 3.2 Add focused tests for Huawei-style tokenization scenarios, including unified command-name highlighting before `:`, parameter-name highlighting, value forms such as quoted strings, bareword enums, symbolic values, prefixed literals, empty command bodies, and multiple statements per line.
- [x] 3.3 Verify that MML syntax highlighting does not change store-centered save behavior, MML metadata refresh behavior, or continue-processing behavior for the active file.

## 4. Spec Updates

- [x] 4.1 Update `agent-web-workbench` spec coverage to define dedicated MML Monaco language behavior in text view.
- [x] 4.2 Add spec coverage for supported MML comment highlighting forms and domain-oriented tokenization boundaries.
- [x] 4.3 Add spec coverage that preserves the boundary between editor comment tokenization and standard leading-header metadata parsing.
