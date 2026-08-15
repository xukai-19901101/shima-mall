# 积分对账 KPI 同步 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将“积分账户”统一更名为“积分对账”，并在页面顶部增加六项月度与当前积分 KPI，同时保持原企业账户明细和商城订单操作能力不变。

**Architecture:** 继续沿用 `admin.html` 单文件静态原型。把现有资金对账卡片渲染器参数化为可接收标题和指标数组的共用函数，`points-accounts` 与 `api-reconciliation` 各自提供独立指标数据，复用同一视觉和响应式结构；内部视图代码 `points-accounts` 不变。

**Tech Stack:** HTML5、CSS3、Vanilla JavaScript、Node.js `node:test`、Playwright、Google Chrome。

**执行状态：** 已完成；22 项静态测试和完整浏览器回归通过，未创建提交。

## Global Constraints

- Web 后台展示名称统一为“积分对账”，内部视图代码继续使用 `points-accounts`。
- 积分对账固定展示：本月积分充值、本月积分消费、当前可用积分、当前冻结积分、本月累计差异、待核对订单。
- 充值、消费、累计差异按当前自然月累计；可用和冻结积分展示当前快照；待核对订单不受月份边界限制。
- 查询表单只过滤下方账户明细，不改变顶部 KPI。
- 原查询、重置、登记积分充值、表格和分页流程保持不变。
- 商城订单与 API 订单现有操作栏和动态按钮必须继续通过回归。
- 1440px 六卡单行；1024px 三卡两行且无页面级横向滚动。
- 不新增权限逻辑、KPI 下钻、趋势、自定义周期、API、schema 或数据迁移。
- 当前仓库无提交历史且文件均未跟踪；不创建提交、不清理用户文件。

---

### Task 1: 固化菜单更名与积分 KPI 静态合约

**Files:**
- Modify: `tests/prototype.test.js`
- Modify: `docs/拾马商城后台一期PRD.md`

**Interfaces:**
- Consumes: `data-view="points-accounts"`、`data-order-actions`、现有查询列表合约。
- Produces: `data-points-reconciliation-kpis`、`data-reconciliation-kpi`、`data-reconciliation-kpi-value`、`data-reconciliation-kpi-note`。

- [x] **Step 1: 更新导航合约测试**

将导航标签断言中的“积分账户”改为“积分对账”，并增加旧菜单文案不存在的约束：

```js
for (const label of ['商城订单', '积分对账', 'API订单', '资金对账']) {
  assert.match(html, new RegExp(label));
}
assert.doesNotMatch(html, />积分账户</);
```

- [x] **Step 2: 增加积分对账 KPI 静态测试**

在 `tests/prototype.test.js` 增加独立用例：

```js
test('points reconciliation mirrors the approved monthly KPI overview', () => {
  const html = read('admin.html');
  for (const marker of [
    'data-points-reconciliation-kpis',
    'data-reconciliation-kpi',
    'data-reconciliation-kpi-value',
    'data-reconciliation-kpi-note'
  ]) {
    assert.match(html, new RegExp(marker));
  }
  for (const label of ['本月积分充值', '本月积分消费', '当前可用积分', '当前冻结积分', '本月累计差异', '待核对订单']) {
    assert.match(html, new RegExp(label));
  }
});
```

- [x] **Step 3: 运行 RED 并确认失败原因**

Run:

```bash
node --test --test-name-pattern='minimum-loop navigation|points reconciliation' tests/prototype.test.js
```

Expected: FAIL，原因分别为页面仍显示“积分账户”且缺少 `data-points-reconciliation-kpis`。

- [x] **Step 4: 更新 PRD 命名与积分对账章节**

在 `docs/拾马商城后台一期PRD.md` 中：

1. 菜单树“积分账户”改为“积分对账”。
2. “5.3 积分账户”改为“5.3 积分对账”。
3. 补充六项 KPI、月累计与快照边界、差异去重、查询不影响 KPI、1440/1024 响应式规则。
4. 保留原账户明细字段和登记积分充值流程。
5. 商城订单章节不增加权限内容。

### Task 2: 实现积分对账更名与共用 KPI 看板

**Files:**
- Modify: `admin.html`
- Test: `tests/prototype.test.js`

**Interfaces:**
- Consumes: `meta`、`adminMenuTree`、`listPage(view)`、`.reconciliation-kpis` 响应式样式。
- Produces: `const pointsReconciliationKpis`、`function reconciliationKpiBoard(kpis, ariaLabel, marker = ''): string`。

- [x] **Step 1: 完成所有展示文案更名**

保持 `data-view="points-accounts"` 和角色 `menuCodes` 不变，只修改用户可见文案：

- 侧边栏菜单：`积分对账`
- `meta['points-accounts'][0]`：`积分对账`
- 页面说明：`按企业汇总积分充值、消费、冻结与账户余额，核对订单积分结果`
- `adminMenuTree` 子菜单名称：`积分对账`
- 商城运营角色描述：`负责小程序客户、商城订单与积分对账`

- [x] **Step 2: 定义积分 KPI 数据**

在现有资金 KPI 数据旁增加：

```js
const pointsReconciliationKpis = [
  ['本月积分充值', '42,600,000 积分', '18 家企业 · 46 笔充值', 'brand'],
  ['本月积分消费', '68,426,000 积分', '2,318 笔订单已扣减', 'success'],
  ['当前可用积分', '13,180,000 积分', '28 个账户 · 更新于 14:28', 'brand'],
  ['当前冻结积分', '1,286,000 积分', '对应 68 笔处理中订单', 'warning'],
  ['本月累计差异', '12,000 积分', '2 笔差异尚未解决', 'danger'],
  ['待核对订单', '3 笔', '最长待处理 1 小时 36 分', 'danger']
];
```

- [x] **Step 3: 参数化共用渲染函数**

将现有函数改为：

```js
function reconciliationKpiBoard(kpis, ariaLabel, marker = '') {
  const cards = kpis.map(([label, value, note, tone]) => `<article class="reconciliation-kpi tone-${tone}" data-reconciliation-kpi><span>${label}</span><strong data-reconciliation-kpi-value>${value}</strong><small data-reconciliation-kpi-note>${note}</small></article>`).join('');
  return `<section class="reconciliation-kpis" data-reconciliation-kpis ${marker} aria-label="${ariaLabel}">${cards}</section>`;
}
```

在 `listPage(view)` 中按视图注入：

```js
const reconciliationOverview = view === 'api-reconciliation'
  ? reconciliationKpiBoard(reconciliationKpis, '资金对账关键指标')
  : view === 'points-accounts'
    ? reconciliationKpiBoard(pointsReconciliationKpis, '积分对账关键指标', 'data-points-reconciliation-kpis')
    : '';
```

- [x] **Step 4: 运行 GREEN 与全量静态测试**

Run:

```bash
node --test tests/prototype.test.js
```

Expected: 所有静态测试通过，原资金对账 KPI 和订单操作栏合约保持通过。

### Task 3: 增加真实浏览器回归并完成文档状态

**Files:**
- Modify: `tests/visual-check.js`
- Modify: `docs/superpowers/specs/2026-08-15-points-reconciliation-kpi-sync-design.md`
- Modify: `docs/superpowers/plans/2026-08-15-points-reconciliation-kpi-sync.md`
- Produces: `artifacts/admin-points-reconciliation.png`
- Produces: `artifacts/admin-points-reconciliation-compact.png`

**Interfaces:**
- Consumes: `[data-view="points-accounts"]`、`[data-points-reconciliation-kpis]`、`[data-query-form]`、`.table-card`。
- Produces: 1440px 与 1024px 页面布局和菜单命名的可重复浏览器验证。

- [x] **Step 1: 增加 1440px 浏览器合约**

在 `tests/visual-check.js` 中打开积分对账页并断言：

```js
await admin.click('[data-view="points-accounts"]');
if ((await admin.locator('[data-view="points-accounts"]').innerText()).trim() !== '积分对账') {
  throw new Error('Points reconciliation navigation label was not renamed');
}
const board = admin.locator('[data-points-reconciliation-kpis]');
if (await board.locator('[data-reconciliation-kpi]').count() !== 6) {
  throw new Error('Points reconciliation does not render six KPI cards');
}
const labels = await board.innerText();
for (const label of ['本月积分充值', '本月积分消费', '当前可用积分', '当前冻结积分', '本月累计差异', '待核对订单']) {
  if (!labels.includes(label)) throw new Error(`Points reconciliation KPI board is missing ${label}`);
}
```

同时比较看板、查询表单和表格位置，必须满足 `board.bottom < query.top` 且 `query.bottom < table.top`；六张卡片顶部误差不得超过 1px。

- [x] **Step 2: 增加 1024px 响应式合约**

使用现有 `compactAdmin` 打开 `points-accounts`，检查页面 `scrollWidth === clientWidth`；前三卡同一行、后三卡同一行，第四卡顶部必须大于第一卡底部。

- [x] **Step 3: 运行浏览器测试并生成截图**

Run:

```bash
NODE_PATH='/Users/xukai/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules' \
'/Users/xukai/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node' tests/visual-check.js
```

Expected: 浏览器回归通过，并生成：

- `artifacts/admin-points-reconciliation.png`
- `artifacts/admin-points-reconciliation-compact.png`

- [x] **Step 4: 更新文档状态并执行最终验证**

将设计和实施计划状态更新为“已实现并通过静态与浏览器回归”，然后运行：

```bash
node --test tests/prototype.test.js
NODE_PATH='/Users/xukai/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules' \
'/Users/xukai/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node' tests/visual-check.js
git diff --check
rg -n '[[:blank:]]+$' admin.html docs tests
```

Expected: 静态和浏览器测试退出码均为 0，`git diff --check` 和尾随空白检查无输出；商城订单与 API 订单操作栏回归仍通过。
