# 分类管理树形表格 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将后台分类管理改为可展开、可编辑的两级树形表格，并分别统计集采商品和自营商品数量。

**Architecture:** 保持 `admin.html` 单文件原型和现有 `render(view)` 路由结构，只替换 `categoryPage()` 的页面结构并补充分类弹窗交互。分类数据以一级分类包含 `children` 的数组组织，一级数量由二级数量聚合，渲染层根据展开状态控制二级行显示。

**Tech Stack:** Markdown、纯 HTML/CSS、原生 JavaScript、Node.js `node:test`、Playwright。

## Global Constraints

- 平台分类仍为两级结构。
- 一级分类汇总下属二级分类商品数，二级分类只统计直属商品数。
- 集采商品数和自营商品数分别展示。
- 分类管理不承载供货平台分类映射操作。
- 保留左上角灰色说明词，不增加重复大标题或整块提示条。
- 不修改 `miniapp.html`。
- 当前文件均未跟踪，未获用户授权时不执行 Git 提交。

---

### Task 1: 分类树形表格静态合同

**Files:**
- Modify: `tests/prototype.test.js`
- Modify: `docs/拾马商城后台一期PRD.md`

**Interfaces:**
- Consumes: `categoryPage()` 输出的 HTML 字符串。
- Produces: 分类树形表格结构、字段和 PRD 口径的静态验收合同。

- [x] **Step 1: 写入失败的静态测试**

在分类与定价测试后增加：

```javascript
test('category management uses an editable two-level tree table', () => {
  const html = read('admin.html');
  for (const label of ['分类名称', '分类编码', '分类层级', '集采商品数', '自营商品数', '排序', '更新时间']) {
    assert.match(html, new RegExp(label));
  }
  assert.match(html, /class="category-tree-table/);
  assert.match(html, /data-category-toggle/);
  assert.match(html, /data-category-edit/);
});
```

- [x] **Step 2: 运行测试并确认 RED**

Run: `node --test tests/prototype.test.js`

Expected: FAIL，缺少 `category-tree-table`、`data-category-toggle`、`集采商品数` 或 `自营商品数`。

- [x] **Step 3: 更新 PRD 分类管理条目**

将 `7.1 分类管理` 明确为：树形表格、九个列表字段、父级汇总/子级直属统计、弹窗编辑，以及有下级或有关联商品时禁止删除。

### Task 2: 树形表格与编辑弹窗

**Files:**
- Modify: `admin.html`

**Interfaces:**
- Consumes: `categoryPage()`、`render(view)`、`toast(message)`。
- Produces: `categoryData`、`renderCategoryRows()`、`openCategoryEditor(categoryId, parentId)` 和树形表格 DOM。

- [x] **Step 1: 增加树形表格和弹窗样式**

新增 `.category-tree-table`、`.category-name-cell`、`.category-expander`、`.category-child-row`、`.modal-backdrop`、`.modal-card` 和 `.modal-form`，复用现有颜色、按钮和表格 token。

- [x] **Step 2: 定义两级分类模拟数据**

数据结构使用：

```javascript
const categoryData = [{
  id: 'office',
  name: '办公用品',
  code: 'CAT-OFFICE',
  level: 1,
  status: '启用',
  sort: 10,
  updatedAt: '08-14 14:20',
  expanded: true,
  children: [{
    id: 'office-consumables',
    name: '办公耗材',
    code: 'CAT-OFFICE-01',
    level: 2,
    sourcingCount: 206,
    selfOperatedCount: 12,
    status: '启用',
    sort: 10,
    updatedAt: '08-14 14:18'
  }]
}];
```

一级分类的两个数量通过 `children.reduce()` 计算，不在父对象中重复维护。

- [x] **Step 3: 替换 `categoryPage()`**

页面输出：灰色说明、查询工具栏、展开全部/收起全部、新增一级分类按钮，以及字段为“分类名称、分类编码、分类层级、集采商品数、自营商品数、状态、排序、更新时间、操作”的树形表格。

- [x] **Step 4: 接入交互事件**

在 `render(view)` 后绑定：

```javascript
content.querySelectorAll('[data-category-toggle]').forEach(button => {
  button.addEventListener('click', () => toggleCategory(button.dataset.categoryToggle));
});
content.querySelectorAll('[data-category-edit]').forEach(button => {
  button.addEventListener('click', () => openCategoryEditor(button.dataset.categoryEdit));
});
```

编辑弹窗包含名称、编码、所属一级分类、排序和状态；数量不进入表单。保存后关闭弹窗并显示成功反馈。

- [x] **Step 5: 运行静态测试并确认 GREEN**

Run: `node --test tests/prototype.test.js`

Expected: 11 个测试全部通过。

### Task 3: 浏览器交互与视觉回归

**Files:**
- Modify: `tests/visual-check.js`
- Generate: `artifacts/admin-category.png`
- Generate: `artifacts/review.png`

**Interfaces:**
- Consumes: 分类树形表格的 `data-category-toggle`、`data-category-child`、`data-category-edit` 和弹窗 DOM。
- Produces: 展开/收起、编辑弹窗、1024px 适配和截图验收证据。

- [x] **Step 1: 先扩充浏览器断言**

分类页检查：

```javascript
for (const label of ['集采商品数', '自营商品数', '新增二级分类']) {
  if (!categoryText.includes(label)) throw new Error(`Category tree table is missing ${label}`);
}
await admin.click('[data-category-toggle="office"]');
if (await admin.locator('[data-category-child][hidden]').count() < 1) {
  throw new Error('Category parent row did not collapse its children');
}
await admin.click('[data-category-toggle="office"]');
await admin.click('[data-category-edit="office-consumables"]');
if (!(await admin.locator('[data-category-modal]').isVisible())) {
  throw new Error('Category editor did not open');
}
```

- [x] **Step 2: 运行浏览器测试**

Run:

```bash
NODE_PATH=/Users/xukai/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules /Users/xukai/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node tests/visual-check.js
```

Expected: 分类展开、弹窗、全部后台页面、分页、小程序兑换流程和响应式检查全部通过。

- [x] **Step 3: 检查截图**

确认 `artifacts/admin-category.png` 在 1440×1000 下呈现清晰树形层级，两类商品数量可独立识别，操作列不拥挤，且无重复大标题。
