# Unified Composer Copy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unify the home and conversation composer areas so they use the same placeholder, upload hint copy, and send button label.

**Architecture:** Keep the existing `ConversationPane` and `HomeStage` structures intact and apply the same interaction copy to both. Extend the existing component tests first, verify they fail on the old copy, then implement the smallest template and computed-state changes needed to satisfy the new copy without changing send or upload behavior.

**Tech Stack:** Vue 3, Vitest, Vue Test Utils, TypeScript

---

### Task 1: Lock the copy contract with failing tests

**Files:**
- Modify: `apps/web/src/components/workbench/ConversationPane.test.ts`
- Modify: `apps/web/src/components/workbench/HomeStage.test.ts`
- Test: `apps/web/src/components/workbench/ConversationPane.test.ts`
- Test: `apps/web/src/components/workbench/HomeStage.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
it('uses the unified composer placeholder, upload hint, and send label in the conversation pane', async () => {
  const wrapper = mount(ConversationPane, {
    props: buildProps()
  })

  await wrapper.get('textarea').setValue('发送一条消息')

  expect(wrapper.get('textarea').attributes('placeholder')).toBe('请输入您的问题，按shift+回车可换行')
  expect(wrapper.text()).toContain('文件上传、点击或拖拽可上传文件，支持的文件：txt、md、csv')
  expect(wrapper.get('.conversation-pane__composer-action').text()).toContain('发送')
})

it('uses the unified composer placeholder, upload hint, and send label on the home stage', async () => {
  const wrapper = mount(HomeStage, {
    props: {
      title: '小曼智能体',
      subtitle: 'MML 配置助手',
      starterGroups: [],
      discoverySkills: [],
      searchQuery: ''
    }
  })

  await wrapper.get('textarea').setValue('首页发送')

  expect(wrapper.get('textarea').attributes('placeholder')).toBe('请输入您的问题，按shift+回车可换行')
  expect(wrapper.text()).toContain('文件上传、点击或拖拽可上传文件，支持的文件：txt、md、csv')
  expect(wrapper.get('.primary-btn').text()).toContain('发送')
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter web test -- --run apps/web/src/components/workbench/ConversationPane.test.ts apps/web/src/components/workbench/HomeStage.test.ts`
Expected: FAIL because the existing placeholder and button text still use the old copy and there is no upload hint text in either composer.

- [ ] **Step 3: Write the minimal implementation**

```ts
const COMPOSER_PLACEHOLDER = '请输入您的问题，按shift+回车可换行'
const COMPOSER_UPLOAD_TIP = '文件上传、点击或拖拽可上传文件，支持的文件：txt、md、csv'
const COMPOSER_SEND_LABEL = '发送'
```

Use the constants in:
- `ConversationPane.vue` placeholder logic for the idle state and action button label
- `HomeStage.vue` textarea placeholder, upload hint text, and send button text

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter web test -- --run apps/web/src/components/workbench/ConversationPane.test.ts apps/web/src/components/workbench/HomeStage.test.ts`
Expected: PASS
