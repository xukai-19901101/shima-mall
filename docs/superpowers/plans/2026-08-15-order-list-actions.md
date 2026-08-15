# 商城订单与 API 订单操作栏 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为商城订单和 API 订单的每条记录增加按状态动态展示的查看详情、发货、退款和关闭订单入口，并提供可校验的操作弹窗与静态状态反馈。

**Architecture:** 保留 `admin.html` 的订单数组与 `orderListPage(view)`，新增纯函数 `getOrderActionModel(row)` 统一计算动作，`renderOrderActions(view, row)` 只负责渲染。两类订单共用一个 `orderActionState` 和一个动态弹窗；确认操作后只修改当前内存行的展示状态并重新渲染当前列表，不接入真实接口或权限模型。

**Tech Stack:** HTML5、CSS3、Vanilla JavaScript、Node.js `node:test`、Playwright、Google Chrome。

**执行状态：** 已完成；21 项静态测试和完整浏览器回归通过，未创建提交。

## Global Constraints

- 商城订单和 API 订单表格都增加最右侧“操作”列。
- 每行始终展示“查看详情”，其余按钮按已确认动作矩阵显示。
- 退款处理中保留禁用的“退款处理中”按钮，禁止重复提交。
- 发货必须填写物流公司和物流单号；退款和关闭订单必须填写原因并二次确认。
- 商城订单退款提示“按原积分及支付路径退回”；API 订单退款提示“按原人民币结算路径退回”。
- 操作后只更新当前静态原型内存，刷新浏览器恢复初始数据。
- 已取消订单只出现在“全部”视图，不进入“待处理”。
- 不增加或修改角色权限、菜单权限、按钮权限或审批流。
- 当前仓库无提交历史且文件均未跟踪；不创建提交、不清理用户文件。

---

### Task 1: 固化动作矩阵与页面合约

**Files:**
- Modify: `tests/prototype.test.js`
- Modify: `tests/visual-check.js`
- Modify: `docs/拾马商城后台一期PRD.md`

**Interfaces:**
- Consumes: `data-view="mini-orders"`、`data-view="api-orders"`、`data-order-row`、`data-order-status-tabs`。
- Produces: `data-order-actions`、`data-order-action`、`data-order-action-modal`、`data-order-action-submit`、`data-order-action-error`。

- [x] **Step 1: 增加静态合约测试**

在 `tests/prototype.test.js` 增加 `order lists expose state-aware row actions` 用例，断言四类操作文案和五个数据标记存在，并断言不存在 `data-order-action-permission`。

- [x] **Step 2: 增加浏览器动作矩阵测试**

在 `tests/visual-check.js` 对当前演示数据断言：

```js
const miniPendingActions = await admin.locator('[data-order-row="MP202608140184"] [data-order-action]').allInnerTexts();
if (JSON.stringify(miniPendingActions) !== JSON.stringify(['查看详情', '发货', '退款'])) {
  throw new Error(`Pending shipment actions are ${miniPendingActions.join(', ')}`);
}
const miniRefundButton = admin.locator('[data-order-row="MP202608140180"] [data-order-action="refund"]');
if (!(await miniRefundButton.isDisabled()) || (await miniRefundButton.innerText()).trim() !== '退款处理中') {
  throw new Error('Refunding order does not expose a disabled progress action');
}
const apiFailedActions = await admin.locator('[data-order-row="API202608140172"] [data-order-action]').allInnerTexts();
if (JSON.stringify(apiFailedActions) !== JSON.stringify(['查看详情', '关闭订单'])) {
  throw new Error(`Failed API order actions are ${apiFailedActions.join(', ')}`);
}
```

同时断言两类订单表头都包含“操作”，每条可见订单都有 `data-order-actions` 和查看详情按钮。

- [x] **Step 3: 增加弹窗和状态变化测试**

浏览器测试覆盖：查看详情只读展示；发货空字段失败、填写后变为已发货；商城与 API 退款文案不同；退款原因和二次确认必填；退款后变为退款中且按钮禁用；关闭原因和二次确认必填；关闭后变为已取消并从待处理视图排除。

- [x] **Step 4: 运行 RED**

```bash
node --test --test-name-pattern='order lists expose state-aware row actions' tests/prototype.test.js
env NODE_PATH='/Users/xukai/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules' '/Users/xukai/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node' tests/visual-check.js
```

预期：静态测试因缺少 `data-order-actions` 失败，浏览器测试因缺少操作列失败。

- [x] **Step 5: 更新 PRD**

在 `docs/拾马商城后台一期PRD.md` 的商城订单和 API 订单章节增加动作矩阵、弹窗校验、原路退款、已取消归类和“本次不做权限”的边界。

### Task 2: 实现操作列与共用弹窗

**Files:**
- Modify: `admin.html`

**Interfaces:**
- Consumes: `rows['mini-orders']`、`rows['api-orders']`、`orderListPage(view)`、`getAggregateOrderStatus(row)`、`render(view)`、`toast(message)`。
- Produces: `getOrderActionModel(row): Array<{action:string,label:string,disabled?:boolean,danger?:boolean}>`、`findOrderRow(view, orderId): Array<string>|undefined`、`renderOrderActions(view, row): string`、`renderOrderActionModal(): string`。

- [x] **Step 1: 实现动作矩阵纯函数**

按“退款/售后处理中 > 已取消 > 采购失败/待重试 > 待付款 > 待发货 > 已发货 > 已完成 > 处理中/结果未知”判断，返回以下模型：

```js
const detailAction = { action: 'detail', label: '查看详情' };
// 待发货
return [detailAction, { action: 'ship', label: '发货' }, { action: 'refund', label: '退款', danger: true }];
// 退款处理中
return [detailAction, { action: 'refund', label: '退款处理中', disabled: true, danger: true }];
```

- [x] **Step 2: 渲染操作列**

为订单表头追加“操作”，为每行增加 `data-order-row="订单号"`、状态字段标记和 `renderOrderActions(view, row)`。操作按钮输出 `data-order-action`、`data-order-view`、`data-order-id`，禁用动作输出原生 `disabled`。

- [x] **Step 3: 增加右侧固定样式**

为 `.order-table th:last-child` 与 `.order-table td:last-child` 设置 `position: sticky; right: 0` 和不透明背景；`.order-actions` 使用单行 flex，风险按钮使用 `.danger-link`，禁用按钮设置 `cursor:not-allowed` 与降低透明度。

- [x] **Step 4: 渲染共用弹窗**

新增 `orderActionState = { view: '', orderId: '', action: '' }` 和 `renderOrderActionModal()`。弹窗包含动态标题、动态表单区、`data-order-action-error`、取消按钮和确认按钮；查看详情模式隐藏确认按钮。

- [x] **Step 5: 运行结构 GREEN**

运行定向静态测试与浏览器动作矩阵段，确认两类订单每行出现正确操作，不修改系统角色页面。

### Task 3: 实现操作校验和静态状态更新

**Files:**
- Modify: `admin.html`
- Modify: `tests/visual-check.js`
- Modify: `docs/superpowers/specs/2026-08-15-order-list-actions-design.md`

**Interfaces:**
- Consumes: Task 2 的 `orderActionState`、`findOrderRow()`、`getOrderActionModel()`、订单操作数据标记。
- Produces: `openOrderActionModal(action, view, orderId): void`、`closeOrderActionModal(): void`、`submitOrderAction(): void`。

- [x] **Step 1: 实现弹窗打开与详情内容**

`openOrderActionModal()` 根据动作生成只读详情、发货字段、退款字段或关闭字段；商城退款说明使用积分及支付路径，API 退款说明使用人民币结算路径。

- [x] **Step 2: 实现校验与状态更新**

`submitOrderAction()` 使用弹窗字段执行：

```js
if (action === 'ship') {
  row[6] = '已发货';
  row[7] = '已受理';
}
if (action === 'refund') {
  row[6] = '退款中';
  row[7] = '退款处理中';
}
if (action === 'close') {
  row[6] = '已取消';
  row[7] = '已关闭';
}
```

任何校验失败只更新 `data-order-action-error`，不得修改行数据。

- [x] **Step 3: 修正已取消聚合状态**

在 `getAggregateOrderStatus(row)` 中让“已取消/已关闭”返回 `CANCELLED`；现有快捷页签不新增取消页签，因此取消订单仅保留在“全部”结果。

- [x] **Step 4: 绑定事件并完成响应式检查**

在 `render(view)` 中绑定操作按钮、弹窗关闭和确认事件；完成 1440px 和 1024px 截图，验证操作列可见、表格内部滚动且页面无新增横向溢出。

- [x] **Step 5: 更新状态并全量验证**

将设计文档状态更新为“已实现并通过静态与浏览器回归”，再运行：

```bash
node --test tests/prototype.test.js
env NODE_PATH='/Users/xukai/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules' '/Users/xukai/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node' tests/visual-check.js
git diff --check
```

预期：全部静态测试和完整浏览器流程通过；不提交。
