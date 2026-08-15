# 查询列表页面统一规范 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 统一所有后台查询列表页，删除表格顶部标题整行，并将查询表单收敛为查询字段、查询和重置。

**Architecture:** 在 `admin.html` 中新增共用 `queryToolbar(fields)` 生成查询表单，所有通用和定制列表页复用该结构。`render(view)` 统一绑定查询与重置行为；重置重新渲染当前页面，使查询条件与页码恢复初始状态。

**Tech Stack:** Markdown、纯 HTML/CSS、原生 JavaScript、Node.js `node:test`、Playwright。

## Global Constraints

- 覆盖所有后台“查询条件 + 数据表格”页面。
- 经营看板与渠道分析报表不改。
- 查询表单只包含查询字段、“查询”和“重置”。
- 页面级新建、导出、同步、批量映射等业务操作保留在灰色说明词右侧。
- 所有列表表格删除 `.table-summary` 整行。
- 重置后清空查询条件、恢复下拉框默认值、页码回到第 1 页并刷新列表。
- 不修改 `miniapp.html`。
- 当前文件均未跟踪，未获用户授权时不执行 Git 提交。

---

### Task 1: 统一列表静态与浏览器合同

**Files:**
- Modify: `tests/prototype.test.js`
- Modify: `tests/visual-check.js`
- Modify: `docs/拾马商城后台一期PRD.md`

**Interfaces:**
- Consumes: 查询列表页面的 DOM。
- Produces: `data-query-form`、`data-query-submit`、`data-query-reset` 与无 `.table-summary` 的验收合同。

- [x] **Step 1: 写入失败的静态测试**

```javascript
test('query list pages use the unified toolbar and no table summary header', () => {
  const html = read('admin.html');
  assert.match(html, /data-query-form/);
  assert.match(html, /data-query-submit/);
  assert.match(html, /data-query-reset/);
  assert.doesNotMatch(html, /class="table-summary"/);
  for (const label of ['更多筛选', '>筛选<', '展开全部', '收起全部']) {
    assert.doesNotMatch(html, new RegExp(label));
  }
});
```

- [x] **Step 2: 扩充浏览器行为测试**

遍历以下视图：

```javascript
const queryListViews = [
  'mini-enterprises', 'mini-orders', 'points-accounts',
  'api-clients', 'api-orders', 'api-reconciliation',
  'category', 'products', 'suppliers', 'category-mapping', 'sourcing-products'
];
```

每页断言：不存在 `.table-summary`；`[data-query-form] button` 文案严格为 `['查询', '重置']`。向首个输入框填值、修改首个下拉框；页面存在分页时切换到第 2 页。点击重置后断言输入框为空、下拉框 `selectedIndex === 0`，存在分页时再断言第 1 页激活。

- [x] **Step 3: 运行测试并确认 RED**

Run:

```bash
node --test tests/prototype.test.js
NODE_PATH=/Users/xukai/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules /Users/xukai/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node tests/visual-check.js
```

Expected: 静态测试因现有 `.table-summary` 和附加按钮失败；浏览器测试因缺少统一重置按钮失败。

- [x] **Step 4: 更新 PRD**

在后台信息架构后增加“查询列表页面统一规范”，写明三段结构、查询表单允许项、表格顶栏删除和重置刷新行为。

### Task 2: 共用查询表单与通用列表

**Files:**
- Modify: `admin.html`

**Interfaces:**
- Produces: `queryToolbar(fieldsHtml: string): string`。
- Consumes: `listPage(view)` 与 `render(view)`。

- [x] **Step 1: 新增共用查询表单生成函数**

```javascript
const queryToolbar = fields => `<div class="toolbar" data-query-form>${fields}<button class="btn primary" data-query-submit>查询</button><button class="btn" data-query-reset>重置</button></div>`;
```

- [x] **Step 2: 改造 `listPage(view)`**

删除“更多筛选”按钮与 `.table-summary`，使用 `queryToolbar()` 输出搜索输入框、状态下拉框、查询和重置；表格列头紧接查询表单。

- [x] **Step 3: 统一绑定查询与重置**

在 `render(view)` 中：

```javascript
content.querySelector('[data-query-submit]')?.addEventListener('click', () => toast('已按当前条件查询'));
content.querySelector('[data-query-reset]')?.addEventListener('click', () => {
  render(view);
  toast('查询条件已重置，列表已刷新');
});
```

- [x] **Step 4: 删除表格顶部样式**

删除 `.table-summary`、`.table-summary strong`、`.summary-meta` 与 `.summary-actions` 样式，保留 `.table-card`、表格和分页。

### Task 3: 定制列表页面统一改造

**Files:**
- Modify: `admin.html`

**Interfaces:**
- Consumes: `queryToolbar(fieldsHtml)`。
- Produces: 分类管理、供货平台、分类映射、集采商品四类定制查询列表。

- [x] **Step 1: 改造分类管理**

查询表单仅保留分类名称/编码、分类层级、状态、查询、重置；删除展开全部、收起全部和表格顶部标题整行，保留行级展开与分类操作。

- [x] **Step 2: 改造供货平台**

查询表单仅保留平台搜索、连接状态、查询、重置；删除“筛选”和表格顶部刷新状态整行。

- [x] **Step 3: 改造分类映射**

查询表单保留供货平台、分类搜索、映射状态、查询、重置；导出关系与批量映射继续位于页面级操作区。

- [x] **Step 4: 改造集采商品**

将供货平台下拉框移入查询表单；查询表单仅保留供货平台、商品搜索、映射状态、库存状态、查询、重置。同步商品与批量设置展示放在页面级操作区，删除表格顶部标题整行。

- [x] **Step 5: 清理废弃分类批量展开代码**

删除 `setAllCategoriesExpanded()` 和 `data-category-expand-all`、`data-category-collapse-all` 事件绑定；行级 `data-category-toggle` 保留。

### Task 4: GREEN 与视觉复核

**Files:**
- Modify: `docs/superpowers/specs/2026-08-14-query-list-page-standard-design.md`
- Generate: `artifacts/admin-category.png`
- Generate: `artifacts/admin-products.png`
- Generate: `artifacts/admin-sourcing-products.png`

**Interfaces:**
- Consumes: 完成后的统一查询列表 DOM。
- Produces: 静态、交互和视觉验收证据。

- [x] **Step 1: 运行完整测试**

Run:

```bash
node --test tests/prototype.test.js
NODE_PATH=/Users/xukai/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules /Users/xukai/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node tests/visual-check.js
```

Expected: 全部静态测试和浏览器交互测试通过。

- [x] **Step 2: 检查截图**

确认列表页查询区按钮严格为“查询、重置”，查询区下方直接显示表格列头，不再出现表格标题整行。

- [x] **Step 3: 更新规格状态**

将统一查询列表规范状态改为“方案已确认，原型已实施”。
