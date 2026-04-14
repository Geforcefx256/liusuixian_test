## MODIFIED Requirements

### Requirement: Runtime SHALL provide an internal MML schema contract for table-view editing
The runtime SHALL expose an internal MML schema response keyed by `networkType` and `networkVersion` so the frontend can drive MML table-view columns and editability without depending directly on the future upstream schema service.

#### Scenario: Schema lookup returns command metadata for supported network context
- **WHEN** a client requests MML schema for a supported `networkType` and `networkVersion`
- **THEN** the runtime MUST return command-level and parameter-level metadata needed for MML table projection
- **AND** that response MUST be shaped as an internal normalized contract rather than a raw upstream-only payload

#### Scenario: Unsupported network context returns no schema without breaking the workspace flow
- **WHEN** a client requests MML schema for a `networkType` and `networkVersion` pair that the runtime does not support
- **THEN** the runtime MUST return an unavailable or empty schema result rather than fabricated command metadata
- **AND** the response MUST still allow the frontend to degrade the table view safely to read-only

#### Scenario: Conditional requiredness remains distinguishable from unconditional requiredness
- **WHEN** the runtime normalizes schema metadata for a parameter whose Excel rule marks it as conditionally required
- **THEN** the returned parameter contract MUST preserve that parameter as conditionally required through `requiredMode` and condition metadata
- **AND** the runtime MUST NOT collapse that parameter into unconditional `required` semantics when the condition has not been evaluated

### Requirement: Runtime SHALL normalize duplicated or inconsistent upstream-like schema data before returning it
The runtime SHALL normalize upstream-like MML schema payloads before they reach the frontend so duplicated command blocks and inconsistent parameter fields do not leak into the workbench table model.

#### Scenario: Duplicate command entries merge into one stable command definition
- **WHEN** the upstream-like schema source contains repeated entries for the same `commandName`
- **THEN** the runtime MUST merge those entries into one returned command definition
- **AND** the frontend MUST NOT be required to choose between first-write-wins or last-write-wins command replacement

#### Scenario: Duplicate parameters merge within a command definition
- **WHEN** the upstream-like schema source repeats the same `paramName` under one logical command
- **THEN** the runtime MUST merge those repeated parameter entries into one stable returned parameter definition
- **AND** the returned command metadata MUST remain suitable for deterministic column generation

#### Scenario: Inconsistent upstream-like fields normalize before frontend use
- **WHEN** upstream-like schema payloads contain inconsistent field shapes such as enum arrays, required flags, ordering metadata, or default-value field names
- **THEN** the runtime MUST normalize those fields into the internal schema contract before returning the response
- **AND** the frontend MUST be able to consume the normalized schema without provider-specific repair logic

#### Scenario: Conditional Excel rules do not yield false required flags
- **WHEN** the imported workbook marks a parameter as `条件必选` or `条件可选`
- **THEN** the normalized schema MUST preserve the conditional rule trigger data needed for later evaluation
- **AND** unconditional boolean required flags in the returned contract MUST describe only always-required parameters
