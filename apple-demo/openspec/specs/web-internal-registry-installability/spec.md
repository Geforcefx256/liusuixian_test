# web-internal-registry-installability Specification

## Purpose
TBD - created by archiving change relock-web-dependencies-for-internal-registry. Update Purpose after archive.
## Requirements
### Requirement: Frontend lockfile SHALL resolve against the internal registry
The system SHALL maintain `apps/web` dependency metadata such that `npm install` can resolve the frontend dependency graph from the approved internal npm registry in the target Windows environment.

#### Scenario: Internal registry provides the relocked dependency set
- **WHEN** the frontend lockfile is regenerated for `apps/web`
- **THEN** it MUST resolve `rollup`, required Windows platform packages, and related build dependencies to exact versions confirmed to exist in the internal registry

#### Scenario: Install uses the committed dependency metadata
- **WHEN** a developer runs `npm install` in `apps/web` using the approved internal registry configuration
- **THEN** dependency resolution MUST complete without requiring public npm registry access

### Requirement: Frontend relock SHALL preserve the existing Vite 5 toolchain behavior
The system SHALL keep the current Vite 5 based frontend toolchain compatible while restoring installability, rather than solving the issue by downgrading the toolchain generation.

#### Scenario: Toolchain generation remains unchanged
- **WHEN** the lockfile is updated to restore installability
- **THEN** the direct frontend toolchain versions in `apps/web/package.json` MUST remain within the Vite 5 compatibility line unless a narrower compatible pin is proven necessary for deterministic relocking

#### Scenario: No product behavior change is introduced
- **WHEN** the dependency relock is applied
- **THEN** frontend runtime behavior, backend APIs, and user-facing application features MUST remain unchanged

### Requirement: Dependency relock SHALL be validated in the constrained environment
The system SHALL verify the relocked frontend dependency graph in the internal-registry environment before the change is considered complete.

#### Scenario: Install validation succeeds
- **WHEN** the relocked dependency metadata is tested in the target Windows environment
- **THEN** `npm install` in `apps/web` MUST complete successfully

#### Scenario: Follow-up validation confirms no immediate toolchain breakage
- **WHEN** `npm install` succeeds after the relock
- **THEN** at least one frontend verification command such as build or type-check MUST complete successfully

