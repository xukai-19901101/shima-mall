# 订单状态快捷页签 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为商城订单和 API 订单列表增加共用的聚合订单状态快捷页签、状态计数和列表过滤交互。

**Architecture:** 在 `admin.html` 中新增订单页专用状态配置、视图状态和 `orderListPage(view)` 渲染器，商城订单与 API 订单共用一套聚合规则。现有订单静态行保持不变，聚合状态由订单状态和采购结果派生，不写回数据。

**Tech Stack:** 纯 HTML、CSS、原生 JavaScript、Node.js `node:test`、Playwright。

## Global Constraints

- 页签固定为：全部、待处理、待发货、已发货、已完成、售后/异常。
- 聚合优先级为：售后/异常 > 待处理 > 待发货 > 已发货 > 已完成。
- 页签只用于查询展示，不替代底层并行订单状态。
- 查询和重置保留当前页签；点击“全部”才取消状态限制。
- 页签切换、查询和重置均回到第 1 页。
- 查询表单不再提供重复的订单状态下拉框。
- 当前仓库没有提交历史且未授权 Git 提交，不执行提交或推送。

---

### Task 1: 建立订单快捷页签行为契约

**Files:**
- Modify: `tests/prototype.test.js`
- Modify: `tests/visual-check.js`

**Interfaces:**
- Consumes: `mini-orders`、`api-orders` 两个现有页面路由。
- Produces: `data-order-status-tabs`、`data-order-status-tab`、`data-order-count`、`data-order-row` 的静态与浏览器行为契约。

- [x] **Step 1: 添加静态契约测试**

新增静态断言，要求原型包含共用订单页签标记和六个页签文案：

```js
test('order lists expose aggregate status quick tabs', () => {
  const html = read('admin.html');
  for (const marker of ['data-order-status-tabs', 'data-order-status-tab', 'data-order-count', 'data-order-row']) {
    assert.match(html, new RegExp(marker));
  }
  for (const label of ['全部', '待处理', '待发货', '已发货', '已完成', '售后/异常']) {
    assert.match(html, new RegExp(label));
  }
});
```

- [x] **Step 2: 添加浏览器交互测试**

对 `mini-orders` 和 `api-orders` 分别验证：

- 恰好六个页签且“全部”默认选中。
- 六个数量中的状态数量之和等于“全部”。
- “待处理”只显示结果未知订单。
- “售后/异常”在商城订单显示售后订单，在 API 订单显示采购失败订单。
- 点击页签后页码为 1。
- 填写关键词、切到第 2 页后点击重置，关键词清空但当前页签不变。

```js
const expectedTabs = ['全部', '待处理', '待发货', '已发货', '已完成', '售后/异常'];
for (const view of ['mini-orders', 'api-orders']) {
  await admin.click(`[data-view="${view}"]`);
  const tabs = admin.locator('[data-order-status-tab]');
  const labels = (await tabs.allInnerTexts()).map(text => text.replace(/\d+/g, '').trim());
  if (JSON.stringify(labels) !== JSON.stringify(expectedTabs)) throw new Error(`${view} quick tabs are incomplete`);
  await admin.click('[data-order-status-tab="PENDING"]');
  const pendingRows = await admin.locator('[data-order-row]').allInnerTexts();
  if (!pendingRows.every(text => text.includes('结果未知'))) throw new Error(`${view} pending tab contains wrong orders`);
}
```

- [x] **Step 3: 运行测试确认红灯**

Run:

```bash
node --test tests/prototype.test.js
NODE_PATH='/Users/xukai/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules' \
'/Users/xukai/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node' tests/visual-check.js
```

Expected: 静态测试因缺少 `data-order-status-tabs` 失败；浏览器测试因找不到页签失败。

### Task 2: 实现共用订单快捷视图

**Files:**
- Modify: `admin.html`

**Interfaces:**
- Consumes: `rows['mini-orders']`、`rows['api-orders']`、`meta`、`queryToolbar()`、`pagination()`。
- Produces: `orderStatusOptions`、`orderViewStates`、`getAggregateOrderStatus(row)`、`orderListPage(view)`。

- [x] **Step 1: 增加页签样式**

在查询列表样式附近增加：

```css
.quick-tabs { display:flex; align-items:center; gap:4px; margin-bottom:14px; padding:0 14px; background:white; border:1px solid var(--line); border-radius:var(--radius); overflow-x:auto; }
.quick-tab { min-height:48px; display:inline-flex; align-items:center; gap:7px; padding:0 14px; border:0; border-bottom:2px solid transparent; color:var(--muted); background:transparent; cursor:pointer; white-space:nowrap; }
.quick-tab.active { color:var(--brand); border-bottom-color:var(--brand); font-weight:700; }
.quick-tab-count { min-width:20px; padding:2px 6px; border-radius:10px; background:#F1F3F7; font-size:10px; text-align:center; }
.quick-tab.active .quick-tab-count { color:var(--brand-dark); background:#EEF2FF; }
```

- [x] **Step 2: 增加共用状态配置与聚合函数**

```js
const orderStatusOptions = [
  ['ALL','全部'], ['PENDING','待处理'], ['TO_SHIP','待发货'],
  ['SHIPPED','已发货'], ['COMPLETED','已完成'], ['AFTER_SALE_OR_EXCEPTION','售后/异常']
];
const orderViewStates = {
  'mini-orders': { aggregateStatus:'ALL', keyword:'' },
  'api-orders': { aggregateStatus:'ALL', keyword:'' }
};
```

`getAggregateOrderStatus(row)` 使用第 7 列订单状态和第 8 列采购结果，按已确认优先级返回唯一状态；售后、退款、采购失败、待重试先返回 `AFTER_SALE_OR_EXCEPTION`，处理中、结果未知返回 `PENDING`，再依次判断待发货、已发货和已完成。

- [x] **Step 3: 实现订单专用渲染器**

`orderListPage(view)`：

- 根据当前 keyword 计算六个页签数量。
- 根据 `aggregateStatus` 和 keyword 过滤订单行。
- 页签置于页面说明区之后、查询表单之前。
- 查询表单只包含一个“搜索订单号、客户或商品”输入框以及查询、重置。
- 订单行增加 `data-order-row`。

- [x] **Step 4: 注册页面和事件**

- 在 `pageRenderers` 注册 `mini-orders` 与 `api-orders` 使用 `orderListPage`。
- 点击 `data-order-status-tab` 更新当前页面的 `aggregateStatus` 并重新渲染。
- 订单页点击查询时保存 keyword 后重新渲染。
- 订单页点击重置时只清空 keyword，保留 `aggregateStatus`。
- 其他列表继续沿用现有通用查询逻辑。

- [x] **Step 5: 运行静态和浏览器测试转绿**

Run:

```bash
node --test tests/prototype.test.js
NODE_PATH='/Users/xukai/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules' \
'/Users/xukai/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node' tests/visual-check.js
```

Expected: 两套测试全部通过，并生成商城订单和 API 订单页截图。

### Task 3: 同步 PRD 与设计状态

**Files:**
- Modify: `docs/拾马商城后台一期PRD.md`
- Modify: `docs/superpowers/specs/2026-08-14-query-list-page-standard-design.md`
- Modify: `docs/superpowers/specs/2026-08-14-order-status-quick-tabs-design.md`
- Modify: `docs/superpowers/plans/2026-08-14-order-status-quick-tabs.md`

**Interfaces:**
- Consumes: 最终页签交互与聚合规则。
- Produces: 无冲突的当前需求文档和完成状态。

- [x] **Step 1: 更新 PRD**

在商城订单和 API 订单章节补充六个快捷页签、聚合状态优先级、查询/重置保留页签以及底层状态不变。

- [x] **Step 2: 更新查询列表特殊规则**

在统一查询列表规范中补充：订单快捷页签位于查询表单上方，状态下拉框不重复展示，重置保留当前页签。

- [x] **Step 3: 更新规格状态并完成检查**

将订单快捷页签设计状态改为“方案已确认，原型已实施”，勾选本计划全部步骤。

- [x] **Step 4: 最终验证**

Run:

```bash
node --test tests/prototype.test.js
NODE_PATH='/Users/xukai/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules' \
'/Users/xukai/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node' tests/visual-check.js
rg -n 'data-order-status-tabs|data-order-status-tab|data-order-count|data-order-row' admin.html
```

Expected: 所有测试通过，四个订单页签标记均存在。
