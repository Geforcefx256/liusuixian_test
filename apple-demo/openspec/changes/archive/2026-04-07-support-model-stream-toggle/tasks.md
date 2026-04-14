## 1. Model Config Support

- [x] 1.1 Extend `AgentModelConfig` and config-loading validation to accept per-model `stream?: boolean` with default streaming behavior preserved when omitted
- [x] 1.2 Update shipped agent-backend config examples and runtime-facing model metadata surfaces to include the new `stream` field where relevant

## 2. Provider Request/Response Handling

- [x] 2.1 Refactor `ProviderClient` request-body construction to honor the resolved model `stream` setting instead of forcing `stream: true`
- [x] 2.2 Wire `ProviderClient` to parse SSE responses for `stream: true` and standard JSON completion responses for `stream: false` while preserving normalized text, tool-call, finish-reason, and usage results
- [x] 2.3 Document and implement the accepted compatibility behavior for `streamFirstByteTimeoutMs` and `streamIdleTimeoutMs` when `stream: false`

## 3. Verification

- [x] 3.1 Add or update `ConfigLoader` tests to cover omitted `stream`, explicit `stream: false`, and model resolution behavior across defaultModel/modelRegistry/modelsByAgent
- [x] 3.2 Add or update `ProviderClient` tests to cover streaming requests, non-stream JSON responses, and explicit failure when non-stream responses omit usage
- [x] 3.3 Run the relevant agent-backend test suite and confirm the new stream-toggle behavior does not change the existing workbench-facing event contract
