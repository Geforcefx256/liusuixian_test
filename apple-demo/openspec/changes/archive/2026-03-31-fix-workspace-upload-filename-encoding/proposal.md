## Why

当前 `apps/agent-backend` 上传路由通过 `multer` 解析 multipart 文件名时沿用了默认 `latin1` 参数字符集，导致中文文件名在进入工作区前就被错误解码，最终在工作区侧栏、打开文件返回值和磁盘路径中显示为乱码。这个问题已经影响用户对工作区文件的识别，且根因明确集中在上传边界，适合单独收敛为一个小范围修复变更。

## What Changes

- 在 `apps/agent-backend` 工作区上传路由中显式将 multipart 文件名参数按 UTF-8 解码，确保中文文件名在 `req.file.originalname` 阶段即保持可读。
- 保持现有 `fileStore`、workspace metadata 和文件打开 contract 不变，仅让它们继续透传已正确解码的原始文件名。
- 为后端上传流补充回归测试，覆盖中文文件名上传后的响应、工作区列表和后续打开文件返回值。
- 明确本次变更不处理历史上已经写入工作区的乱码文件，也不增加迁移、兜底重命名或静默修复逻辑。

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `agent-backend-runtime`: 工作区上传流需要明确保证 UTF-8 文件名在 multipart 上传、workspace metadata 返回和后续文件打开链路中保持原始可读文件名。

## Impact

- Affected code:
  - `apps/agent-backend/src/routes/files.ts`
  - `apps/agent-backend/tests/files.routes.test.ts`
  - related workspace upload tests if they assert filename surfaces
- APIs:
  - no endpoint shape changes; existing `/agent/api/files/upload` response contract remains the same
- Dependencies:
  - no new third-party dependencies are required
- Systems:
  - multipart upload parsing at the `agent-backend` boundary
  - scoped workspace upload metadata under `apps/agent-backend/workspace`
