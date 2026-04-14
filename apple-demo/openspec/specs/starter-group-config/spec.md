# starter-group-config Specification

## Purpose
TBD - created by archiving change fix-starter-group-copy-and-extract-config. Update Purpose after archive.
## Requirements
### Requirement: Starter group metadata SHALL be defined in an external JSON config file
快速开始分组的静态配置（title、subtitle、icon、discoveryQuery、emptyTitle、emptyDescription）SHALL 存放在 `apps/web/src/config/starterGroups.json`，由 workbenchStore 通过 import 加载，不得在 store 文件中硬编码。

#### Scenario: JSON config is imported by workbenchStore
- **WHEN** workbenchStore initializes the starter group metadata
- **THEN** it MUST import the data from `apps/web/src/config/starterGroups.json`
- **AND** MUST NOT define the group metadata as an inline TypeScript constant

#### Scenario: JSON config contains correct subtitle copy
- **WHEN** starterGroups.json is read
- **THEN** the three group subtitles MUST be：
  - planning 组：`选择Skill快速开始生成配置方案`
  - configuration-authoring 组：`选择Skill快速开始生成MML配置`
  - verification 组：`选择Skill快速开始核查`

