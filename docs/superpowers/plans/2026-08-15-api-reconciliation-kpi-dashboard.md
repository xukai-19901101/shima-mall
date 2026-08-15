# 资金对账关键 KPI 看板 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在资金对账页说明区与查询表单之间增加六项综合 KPI 看板，同时保留原对账查询、操作和表格流程。

**Architecture:** 继续使用 `admin.html` 单文件静态原型，在现有 `listPage(view)` 中仅为 `api-reconciliation` 注入专用的 `reconciliationKpiBoard()`。指标数据由独立的 `reconciliationKpis` 数组提供，样式使用页面专属类名，避免影响渠道分析和其他列表页面。

**Tech Stack:** HTML5、CSS3、Vanilla JavaScript、Node.js `node:test`、Playwright、Google Chrome。

**执行状态：** 已完成；20 项静态测试和完整浏览器回归通过，未创建提交。

## Global Constraints

- 看板固定展示本月采购金额、本月退款与调整、当前接口余额、当前账面余额、本月累计差异、待核对订单六项 KPI。
- 月累计指标与余额快照必须通过辅助文案明确区分。
- KPI 看板位于页面说明与查询表单之间。
- 查询表单只过滤下方对账记录，不影响顶部 KPI。
- 原“立即校对”、查询、重置、表格与分页流程保持不变。
- 1440px 下六列单行；1024px 下三列两行且不产生页面级横向滚动。
- 不增加趋势图、点击下钻、自定义周期、真实余额接口调用或自动刷新。
- 当前仓库无提交历史且文件均未跟踪；不创建提交、不清理用户文件。

---

### Task 1: 固化 KPI 页面合约与 PRD

**Files:**
- Modify: `tests/prototype.test.js`
- Modify: `tests/visual-check.js`
- Modify: `docs/拾马商城后台一期PRD.md`

**Interfaces:**
- Consumes: 现有 `data-view="api-reconciliation"`、`data-query-form`、资金对账表格。
- Produces: `data-reconciliation-kpis`、`data-reconciliation-kpi`、`data-reconciliation-kpi-value`、`data-reconciliation-kpi-note`。

- [x] **Step 1: 增加静态合约测试**

在 `tests/prototype.test.js` 增加资金对账 KPI 用例，断言 `admin.html` 同时包含四个新数据标记、六个指标名称，并继续包含查询表单和原资金对账字段。

- [x] **Step 2: 增加浏览器合约测试**

在 `tests/visual-check.js` 打开资金对账页后断言：

```js
const reconciliationKpis = admin.locator('[data-reconciliation-kpi]');
if (await reconciliationKpis.count() !== 6) {
  throw new Error('Reconciliation page does not render six KPI cards');
}
const reconciliationText = await admin.locator('[data-reconciliation-kpis]').innerText();
for (const label of ['本月采购金额', '本月退款与调整', '当前接口余额', '当前账面余额', '本月累计差异', '待核对订单']) {
  if (!reconciliationText.includes(label)) throw new Error(`Reconciliation KPI board is missing ${label}`);
}
```

同时比较 KPI 看板、查询表单和表格的 `getBoundingClientRect().y`，确保垂直顺序为“看板 → 查询 → 表格”；在 1440px 断言六卡同一行，在 1024px 断言第一行三卡、第四卡进入第二行，并检查页面无横向溢出。

- [x] **Step 3: 运行 RED**

```bash
node --test --test-name-pattern='reconciliation KPI' tests/prototype.test.js
env NODE_PATH='/Users/xukai/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules' '/Users/xukai/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node' tests/visual-check.js
```

预期：因 `data-reconciliation-kpis` 尚不存在失败。

- [x] **Step 4: 更新 PRD**

在 `docs/拾马商城后台一期PRD.md` 的“6.3 资金对账”中增加六项 KPI、月累计与余额快照边界、查询不影响 KPI、1440/1024 响应式规则。

### Task 2: 实现 KPI 看板并完成回归

**Files:**
- Modify: `admin.html`
- Modify: `tests/visual-check.js`
- Modify: `docs/superpowers/specs/2026-08-15-api-reconciliation-kpi-dashboard-design.md`

**Interfaces:**
- Consumes: `listPage(view)`、`meta['api-reconciliation']`、现有颜色变量 `--brand`、`--success`、`--warning`、`--danger`。
- Produces: `const reconciliationKpis`、`function reconciliationKpiBoard(): string`。

- [x] **Step 1: 定义指标数据与渲染函数**

在 `admin.html` 的 `meta` 与列表渲染函数之间增加：

```js
const reconciliationKpis = [
  ['本月采购金额', '¥1,246,580.00', '已覆盖 3 个供货平台', 'brand'],
  ['本月退款与调整', '¥32,460.00', '退款 16 笔 · 调账 2 笔', 'warning'],
  ['当前接口余额', '¥547,880.00', '最近校对 08-15 14:28', 'success'],
  ['当前账面余额', '¥547,760.00', '按理论余额公式计算', 'brand'],
  ['本月累计差异', '¥120.00', '1 个平台存在差异', 'danger'],
  ['待核对订单', '2 笔', '最长待处理 2 小时 18 分', 'danger']
];

function reconciliationKpiBoard() {
  return `<section class="reconciliation-kpis" data-reconciliation-kpis aria-label="资金对账关键指标">${reconciliationKpis.map(([label, value, note, tone]) => `<article class="reconciliation-kpi ${tone}" data-reconciliation-kpi><span>${label}</span><strong data-reconciliation-kpi-value>${value}</strong><small data-reconciliation-kpi-note>${note}</small></article>`).join('')}</section>`;
}
```

- [x] **Step 2: 将看板注入资金对账页**

在 `listPage(view)` 中生成：

```js
const reconciliationOverview = view === 'api-reconciliation' ? reconciliationKpiBoard() : '';
```

并把 `${reconciliationOverview}` 放在 `.page-head` 之后、`queryToolbar(...)` 之前，确保其他列表页不出现看板。

- [x] **Step 3: 增加专属样式**

在 `admin.html` 样式区增加 `.reconciliation-kpis` 与 `.reconciliation-kpi`：1440px 使用 `repeat(6, minmax(0, 1fr))`，卡片包含风险色顶部边线、标签、等宽主值和辅助说明；`@media (max-width: 1180px)` 改为 `repeat(3, minmax(0, 1fr))`。

- [x] **Step 4: 运行 GREEN 并检查截图**

执行定向静态测试与浏览器测试，生成 `artifacts/admin-api-reconciliation.png` 和 `artifacts/admin-api-reconciliation-compact.png`，检查卡片层级、金额可读性、两种宽度下的排列和无横向溢出。

- [x] **Step 5: 更新设计状态并全量验证**

将设计文档状态更新为“已实现并通过静态与浏览器回归”，再运行：

```bash
node --test tests/prototype.test.js
env NODE_PATH='/Users/xukai/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules' '/Users/xukai/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node' tests/visual-check.js
git diff --check
```

预期：全部静态测试和完整浏览器流程通过；不提交。
