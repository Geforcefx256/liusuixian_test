## REMOVED Requirements

### Requirement: Runtime SHALL provide an internal MML schema contract for table-view editing
**Reason**: The workbench now loads MML schema from the canonical `web-backend` route at `/web/api/mml/schema`, so `agent-backend` no longer owns or exposes a browser-facing MML schema contract.
**Migration**: Frontend and other browser consumers must request MML schema through `/web/api/mml/schema` and must stop calling `/agent/api/files/mml-schema`.

### Requirement: Runtime SHALL normalize duplicated or inconsistent upstream-like schema data before returning it
**Reason**: Schema normalization remains necessary, but it belongs to the canonical MML rule owner in `web-backend` instead of `agent-backend` after the route cutover.
**Migration**: Consumers must rely on the normalized schema returned by `web-backend` and must not expect `agent-backend` to transform or proxy MML schema payloads.
