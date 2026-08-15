# 渠道经营分析报表合并 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将小程序商城分析与 API 供货分析合并为一个可通过客户类型 Tab 切换的渠道经营分析页，并将首屏改为左侧紧凑指标和右侧订单资金双轨图。

**Architecture:** 继续使用 `admin.html` 的单文件静态原型架构，不引入第三方图表库或拆分无关模块。一个 `analysisViewState` 管理当前客户类型和时间范围，`analysisData` 按 `mini` / `api` 提供整页数据，页面渲染函数保证指标、图表、排行和导出口径同步切换。

**执行状态：** 已于 2026-08-14 完成静态原型、PRD、静态合约测试与 Playwright 视觉验证；未包含真实报表 API、数据库聚合或导出任务。

**Tech Stack:** HTML5、CSS3、Vanilla JavaScript、Node.js `node:test`、Playwright、Google Chrome。

## Global Constraints

- 当前工作区在 `main` 且尚无提交历史；`admin.html`、`docs/`、`tests/` 等均为用户现有未跟踪文件，必须原地小范围修改。
- 2026-08-14 实施前基线为 19 项静态测试中 18 项通过；既有唯一失败是“public API documentation exposes the approved integration chapters”找不到 `api-docs.html`，与本次报表合并无关，不纳入修复范围。
- 未获得明确授权前不创建 Git 提交、不推送、不删除用户文件。每个任务以 `git diff --check` 和测试结果作为检查点。
- 左侧“经营看板”下只保留“经营总览”与“渠道经营分析”；合并页稳定视图标识为 `channel-analysis`。
- 页面 Tab 必须使用“小程序商城客户”与“API 供货客户”全称，不增加“全部渠道”。
- 首屏在宽视口使用 34% / 66% 左右分栏；左侧为 2 列 × 4 行指标，右侧为订单流和资金流双轨图。
- 双轨图是统计聚合视图，不得把订单、采购、履约、积分、结算和售后的并行状态改建模为单一状态机。
- 不修改小程序商城客户、API 供货客户、商品库、供货平台管理和系统管理模块的业务行为。
- 不引入新依赖；图表用语义化 HTML 和 CSS 实现。
- 所有 Tab 使用真实 `button`，具有 `role="tab"`、`aria-selected`、可见键盘焦点；图表不依赖颜色作为唯一信息。
- 静态原型只验证页面与交互合约，不声称真实 API、数据库聚合、导出任务或资金结算已上线。

## File Map

| 文件 | 责任 | 计划变更 |
|---|---|---|
| `admin.html` | 后台静态原型的导航、数据、渲染、交互和样式 | 合并菜单与渲染器，新增 Tab 状态，改造首屏与双轨图 |
| `tests/prototype.test.js` | 源码级静态合约 | 用合并页、双 Tab、双轨图和新 PRD 断言替换两个旧分析页断言 |
| `tests/visual-check.js` | 浏览器交互、布局与截图验证 | 从两个菜单切换改为一个菜单内的 Tab 切换，并校验内容口径 |
| `docs/拾马商城后台一期PRD.md` | 一期产品基线 | 合并信息架构和经营看板章节，写明 Tab 和双轨图 |
| `artifacts/admin-channel-analysis-mini.png` | 小程序客户 Tab 视觉证据 | 由 Playwright 生成 |
| `artifacts/admin-channel-analysis-api.png` | API 供货客户 Tab 视觉证据 | 由 Playwright 生成 |

---

### Task 1: 固化合并后的导航和 PRD 合约

**Files:**
- Modify: `tests/prototype.test.js:8-50`
- Modify: `admin.html:470-477`
- Modify: `admin.html:1390-1425`
- Modify: `docs/拾马商城后台一期PRD.md:30-155`

**Interfaces:**
- Consumes: 现有 `render(view)` 导航切换函数和 `pageRenderers` 映射。
- Produces: 稳定视图 `channel-analysis`；`pageRenderers['channel-analysis']`；PRD 中唯一的渠道分析页定义。

- [ ] **Step 1: 先把静态合约改为目标导航**

将原 `channel analysis pages contain the three approved subreports` 测试替换为：

```js
test('channel analysis is merged behind one navigation entry', () => {
  const html = read('admin.html');
  assert.match(html, /data-view="channel-analysis"/);
  assert.doesNotMatch(html, /data-view="mini-analysis"/);
  assert.doesNotMatch(html, /data-view="api-analysis"/);
  for (const label of ['渠道经营分析', '小程序商城客户', 'API 供货客户']) {
    assert.match(html, new RegExp(label));
  }
  for (const label of ['订单与资金结算闭环', '商品销量排行', '企业贡献排行']) {
    assert.match(html, new RegExp(label));
  }
});
```

同时将“complete minimum-loop navigation”和“approved menus are persisted”中的分析页列表改为只期待“渠道经营分析”，并断言 PRD 的菜单树不再包含两个旧菜单项。

- [ ] **Step 2: 运行定向测试并确认先失败**

Run:

```bash
node --test --test-name-pattern='channel analysis|minimum-loop navigation|approved menus' tests/prototype.test.js
```

Expected: FAIL；报告缺少 `data-view="channel-analysis"` 或仍存在旧视图标识。

- [ ] **Step 3: 合并左侧导航与页面渲染入口**

将导航子项改为：

```html
<button class="nav-item active" data-view="dashboard">经营总览</button>
<button class="nav-item" data-view="channel-analysis">渠道经营分析</button>
```

将 `pageRenderers` 中两个分析视图替换为：

```js
'channel-analysis': () => channelAnalysisPage('mini'),
```

此任务先使用小程序口径保证新菜单可正常打开。Task 2 建立 `analysisViewState` 后，再把此映射改为直接引用 `channelAnalysisPage`，并将该函数改为无参数函数。

- [ ] **Step 4: 合并 PRD 的信息架构和报表章节**

把菜单树改为：

```text
经营看板
├── 经营总览
└── 渠道经营分析
```

将原 `4.2 小程序商城分析` 和 `4.3 API供货分析` 收拢为 `4.2 渠道经营分析`，内部保留两组独立口径。写明：

```text
顶部使用“小程序商城客户”与“API 供货客户” Tab。
切换 Tab 时，指标、订单与资金结算闭环、商品排行、企业排行和导出口径同步切换。
跨渠道汇总仍属于“经营总览”，不设“全部渠道” Tab。
```

- [ ] **Step 5: 运行静态合约并建立检查点**

Run:

```bash
node --test tests/prototype.test.js
git diff --check
```

Expected: 本任务涉及的导航、分析页和 PRD 测试全部 PASS；全量测试不新增失败，只允许保留已记录的 `api-docs.html` 基线失败；`git diff --check` 无输出。检查 `git status --short`，不提交。

### Task 2: 实现双 Tab 与整页口径切换

**Files:**
- Modify: `tests/prototype.test.js:35-65`
- Modify: `tests/visual-check.js:31-52`
- Modify: `admin.html:410-425`
- Modify: `admin.html:560-605`
- Modify: `admin.html:1385-1455`

**Interfaces:**
- Consumes: Task 1 产出的 `channel-analysis` 视图和现有 `analysisData.mini` / `analysisData.api`。
- Produces: `analysisViewState: { channel: 'mini' | 'api', period: '本月' | '本周' | '今天' }`；`analysisTabs()` HTML 生成函数；`data-analysis-tab`、`data-analysis-period`、`data-analysis-export` 交互合约。

- [ ] **Step 1: 增加 Tab 源码合约测试**

在 `tests/prototype.test.js` 的合并页测试中增加：

```js
for (const marker of [
  'analysisViewState',
  'data-analysis-tab',
  'role="tablist"',
  'aria-selected',
  'data-analysis-period',
  'data-analysis-export'
]) {
  assert.match(html, new RegExp(marker));
}
for (const label of ['消费积分', '冻结积分', '采购成功率', '余额差异']) {
  assert.match(html, new RegExp(label));
}
```

- [ ] **Step 2: 将浏览器测试改为单页 Tab 切换**

用以下测试流程替换 `for (const view of ['mini-analysis', 'api-analysis'])` 循环：

```js
await admin.click('[data-view="channel-analysis"]');
const miniTab = admin.locator('[data-analysis-tab="mini"]');
const apiTab = admin.locator('[data-analysis-tab="api"]');
if (await miniTab.getAttribute('aria-selected') !== 'true') {
  throw new Error('Channel analysis does not default to miniapp customers');
}
let analysisText = await admin.locator('#content').innerText();
for (const label of ['消费积分', '冻结积分', '商品销量排行', '企业贡献排行']) {
  if (!analysisText.includes(label)) throw new Error(`Miniapp analysis is missing ${label}`);
}
await admin.selectOption('[data-analysis-period]', { label: '本周' });
await apiTab.click();
if (await apiTab.getAttribute('aria-selected') !== 'true') {
  throw new Error('API customer tab did not become active');
}
if (await admin.locator('[data-analysis-period]').inputValue() !== '本周') {
  throw new Error('Channel tab switch reset the selected period');
}
analysisText = await admin.locator('#content').innerText();
for (const label of ['采购成功率', '余额差异', '上游采购支出', '客户待回款']) {
  if (!analysisText.includes(label)) throw new Error(`API analysis is missing ${label}`);
}
for (const forbidden of ['消费积分', '冻结积分']) {
  if (analysisText.includes(forbidden)) throw new Error(`API analysis leaks miniapp metric ${forbidden}`);
}
```

- [ ] **Step 3: 运行定向测试并确认先失败**

Run:

```bash
node --test --test-name-pattern='channel analysis' tests/prototype.test.js
node tests/visual-check.js
```

Expected: 静态测试因缺少 Tab 标记失败；Playwright 因找不到 `data-analysis-tab` 失败。

- [ ] **Step 4: 定义报表状态与 Tab 元数据**

在 `analysisData` 之前增加：

```js
const analysisViewState = { channel: 'mini', period: '本月' };

const analysisTabs = () => [
  { key: 'mini', label: '小程序商城客户', desc: '积分消费 · 采购履约 · 企业结算', count: '28 家' },
  { key: 'api', label: 'API 供货客户', desc: '人民币订单 · 客户回款 · 上游校对', count: '10 家' }
].map(tab => `<button class="analysis-tab ${analysisViewState.channel === tab.key ? 'active' : ''}" role="tab" aria-selected="${analysisViewState.channel === tab.key}" data-analysis-tab="${tab.key}"><span><strong>${tab.label}</strong><small>${tab.desc}</small></span><b>${tab.count}</b></button>`).join('');
```

为 `analysisData.mini` 与 `analysisData.api` 增加 `tabLabel`，用于页面说明和导出反馈：

```js
tabLabel: '小程序商城客户'
tabLabel: 'API 供货客户'
```

- [ ] **Step 5: 改造合并页渲染函数**

`channelAnalysisPage()` 使用当前状态，并把时间值写回 `select`：

```js
function channelAnalysisPage() {
  const item = analysisData[analysisViewState.channel];
  const periodOptions = ['本月', '本周', '今天']
    .map(period => `<option ${analysisViewState.period === period ? 'selected' : ''}>${period}</option>`)
    .join('');
  return `<div class="analysis-tabs" role="tablist" aria-label="企业客户类型">${analysisTabs()}</div>
    <div class="page-head"><p class="page-desc">${item.desc}</p><div class="page-actions"><select class="field" data-analysis-period>${periodOptions}</select><button class="btn" data-analysis-export>${icon('i-download')}导出报表</button></div></div>
    ${channelAnalysisOverview(item)}
    <section class="panel report-section"><div class="report-head"><span class="report-title">商品销量排行</span><span class="report-note">按订单商品聚合</span><button class="panel-more" onclick="toast('已导出商品排行')">导出</button></div>${dataTable(item.productHeads,item.productRows)}</section>
    <section class="panel report-section"><div class="report-head"><span class="report-title">企业贡献排行</span><span class="report-note">仅汇总企业层，不下钻终端用户</span><button class="panel-more" onclick="toast('已导出企业排行')">导出</button></div>${dataTable(item.enterpriseHeads,item.enterpriseRows)}</section>`;
}
```

同时将 `pageRenderers` 中 Task 1 的临时映射改为：

```js
'channel-analysis': channelAnalysisPage,
```

`channelAnalysisOverview(item)` 由 Task 3 产出；在 Task 3 完成前，先使用下列最小定义保持页面可渲染：

```js
const channelAnalysisOverview = item => `<div class="stat-grid analysis-kpis">${item.kpis.map(kpi => `<article class="stat-card"><div class="stat-top">${kpi[0]}</div><div class="stat-value">${kpi[1]}</div><div class="stat-foot">${kpi[2]}</div></article>`).join('')}</div>`;
```

- [ ] **Step 6: 绑定 Tab、时间和导出交互**

在 `render(view)` 完成 `content.innerHTML` 后增加：

```js
content.querySelectorAll('[data-analysis-tab]').forEach(element => element.addEventListener('click', () => {
  if (analysisViewState.channel === element.dataset.analysisTab) return;
  analysisViewState.channel = element.dataset.analysisTab;
  render('channel-analysis');
}));
content.querySelector('[data-analysis-period]')?.addEventListener('change', event => {
  analysisViewState.period = event.target.value;
  toast(`已切换为${analysisViewState.period}数据`);
});
content.querySelector('[data-analysis-export]')?.addEventListener('click', () => {
  toast(`已导出${analysisData[analysisViewState.channel].tabLabel}${analysisViewState.period}报表`);
});
```

为了只在合并页内保留 Tab，增加 `let currentView = 'dashboard'`，在渲染开始处执行：

```js
if (view === 'channel-analysis' && currentView !== 'channel-analysis') {
  analysisViewState.channel = 'mini';
}
```

在渲染完成时设置 `currentView = view`。Tab 内部重新渲染时 `currentView` 仍是 `channel-analysis`，所以不会错误重置为小程序。

- [ ] **Step 7: 增加 Tab 样式并运行测试**

增加 `.analysis-tabs`、`.analysis-tab`、`.analysis-tab.active`、`.analysis-tab strong`、`.analysis-tab small` 样式。两个 Tab 均分宽度，活动 Tab 使用 `var(--brand)` 背景和白色文字，非活动 Tab 使用白色背景、`var(--muted)` 文字和 `var(--line)` 边框。

Run:

```bash
node --test tests/prototype.test.js
node tests/visual-check.js
git diff --check
```

Expected: 静态合约与 Tab 交互通过；API Tab 不出现小程序积分字段；时间选择在 Tab 切换后保留；无运行错误。

### Task 3: 实现紧凑指标与订单资金双轨图

**Files:**
- Modify: `tests/prototype.test.js:35-75`
- Modify: `tests/visual-check.js:31-75`
- Modify: `admin.html:400-455`
- Modify: `admin.html:560-610`

**Interfaces:**
- Consumes: Task 2 的 `analysisData`、`analysisViewState`、`channelAnalysisPage()`。
- Produces: `channelAnalysisOverview(item)`；`dualTrackFlow(item)`；`item.orderSteps`、`item.fundSteps`、`item.connections`、`item.exceptions` 数据合约；`data-dual-track-flow` DOM 标记。

- [ ] **Step 1: 先增加双轨图结构合约**

在合并页测试中增加：

```js
for (const marker of [
  'analysis-overview',
  'analysis-metrics',
  'data-dual-track-flow',
  'flow-lane',
  'order-lane',
  'fund-lane',
  'flow-connections',
  'flow-exceptions'
]) {
  assert.match(html, new RegExp(marker));
}
for (const label of ['订单流', '资金流', '重点异常', '上游采购支出', '上游余额校对']) {
  assert.match(html, new RegExp(label));
}
```

- [ ] **Step 2: 增加浏览器布局与口径断言**

在小程序 Tab 状态下断言：

```js
if (await admin.locator('.analysis-metrics .analysis-metric').count() !== 8) {
  throw new Error('Channel analysis does not render eight compact metrics');
}
if (await admin.locator('[data-dual-track-flow] .order-lane .flow-node').count() !== 4) {
  throw new Error('Order lane does not render four aligned stages');
}
if (await admin.locator('[data-dual-track-flow] .fund-lane .flow-node').count() !== 4) {
  throw new Error('Settlement lane does not render four aligned stages');
}
for (const label of ['提交订单', '积分冻结', '后结待回款', '重点异常']) {
  if (!analysisText.includes(label)) throw new Error(`Miniapp dual-track flow is missing ${label}`);
}
```

在 API Tab 状态下断言：

```js
for (const label of ['API 订单受理', '余额/授信占用', '客户回款', '上游余额校对']) {
  if (!analysisText.includes(label)) throw new Error(`API dual-track flow is missing ${label}`);
}
```

增加几何检查：1440px 下 `.analysis-overview` 两个子区域左右排列，右侧宽度大于左侧；新建 1024px 页面后两区域上下排列，`document.documentElement.scrollWidth === document.documentElement.clientWidth`。

- [ ] **Step 3: 运行定向测试并确认先失败**

Run:

```bash
node --test --test-name-pattern='channel analysis' tests/prototype.test.js
node tests/visual-check.js
```

Expected: 因缺少 `data-dual-track-flow`、双轨节点或 34/66 布局而 FAIL。

- [ ] **Step 4: 将每个渠道数据改为四阶段对齐模型**

为小程序数据增加：

```js
orderSteps: [
  ['提交订单', '2,463 单', '起始订单'],
  ['采购成功', '2,386 单', '成功率 96.9%'],
  ['履约完成', '2,206 单', '待履约 180 单'],
  ['订单完成', '2,118 单', '已结算 96.0%']
],
fundSteps: [
  ['积分冻结', '2,451 单', '128.6w 积分'],
  ['积分扣减 / 采购支出', '¥ 510,320', '2,318 单已扣减'],
  ['企业结算出账', '¥ 601,960', '以订单快照计价'],
  ['预付入账 / 后结待回款', '¥ 82,300', '4 家企业待跟进']
],
connections: ['提交时冻结', '采购后扣减', '完成后出账', '预付/后结分流'],
exceptions: ['12 单已提交但未冻结', '68 单已采购但未扣减', '后结待回款 ¥ 82,300']
```

为 API 数据增加：

```js
orderSteps: [
  ['API 订单受理', '1,492 单', '起始受理'],
  ['上游采购成功', '1,460 单', '成功率 97.8%'],
  ['履约完成', '1,386 单', '待履约 74 单'],
  ['订单完成', '1,302 单', '完成率 87.3%']
],
fundSteps: [
  ['余额/授信占用', '¥ 600,370', '按客户结算模式'],
  ['上游采购支出', '¥ 468,100', '订单实际成本'],
  ['客户结算出账', '¥ 600,370', '以订单快照计价'],
  ['客户回款 / 上游余额校对', '¥ 413,770', '待回款 ¥ 186,600']
],
connections: ['受理时占用', '采购成功后支出', '完成后出账', '回款与余额校对'],
exceptions: ['32 单采购失败或待重试', '客户待回款 ¥ 186,600', '上游余额差异 ¥ 120']
```

删除不再使用的 `steps` 数组，避免新旧图表数据并存。

- [ ] **Step 5: 实现双轨图渲染函数**

新增：

```js
const flowNodes = (steps, laneClass) => `<div class="flow-lane ${laneClass}">${steps.map((step, index) => `<article class="flow-node ${index === steps.length - 1 ? 'terminal' : ''}"><span>${step[0]}</span><strong>${step[1]}</strong><small>${step[2]}</small></article>`).join('')}</div>`;

const dualTrackFlow = item => `<section class="flow-panel" data-dual-track-flow><div class="flow-head"><div><strong>订单与资金结算闭环</strong><span>订单阶段和资金结果一一对应</span></div><small>更新于 08-14 14:32</small></div><div class="flow-body"><div class="flow-legend"><span>订单节点</span><span>资金节点</span><span>异常 / 待办</span></div><div class="flow-label">订单流</div>${flowNodes(item.orderSteps, 'order-lane')}<div class="flow-connections">${item.connections.map(connection => `<div><i></i><span>${connection}</span></div>`).join('')}</div><div class="flow-label">资金流</div>${flowNodes(item.fundSteps, 'fund-lane')}<div class="flow-exceptions"><strong>重点异常</strong><span>${item.exceptions.join(' · ')}</span></div></div></section>`;

const channelAnalysisOverview = item => `<div class="analysis-overview"><section class="analysis-metric-panel"><div class="analysis-section-head"><strong>核心指标</strong><span>8 项 · ${analysisViewState.period}</span></div><div class="analysis-metrics">${item.kpis.map(kpi => `<article class="analysis-metric"><span>${kpi[0]}</span><strong>${kpi[1]}</strong><small>${kpi[2]}</small></article>`).join('')}</div></section>${dualTrackFlow(item)}</div>`;
```

双轨图的节点文案是主信息，蓝/绿/橙只是辅助分类；不用 SVG 流带暗示订单数与金额具有相同量纲。

- [ ] **Step 6: 实现 34/66 布局与响应式降级**

新增以下样式组，颜色只使用现有 token：

```css
.analysis-overview { display:grid; grid-template-columns:minmax(300px,34fr) minmax(560px,66fr); gap:14px; align-items:stretch; }
.analysis-metric-panel, .flow-panel { overflow:hidden; background:white; border:1px solid var(--line); border-radius:var(--radius); box-shadow:0 4px 16px rgba(20,35,59,.035); }
.analysis-metrics { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:1px; background:var(--line); }
.analysis-metric { min-height:86px; padding:13px 14px; background:white; }
.analysis-metric > span, .analysis-metric small { color:var(--muted); font-size:11px; }
.analysis-metric strong { display:block; margin-top:8px; font-size:20px; font-weight:780; font-variant-numeric:tabular-nums; }
.flow-lane { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:18px; }
.flow-node { min-width:0; position:relative; padding:12px; border:1px solid #DCE4FF; border-radius:8px; background:#F3F5FF; }
.flow-node:not(:last-child)::after { content:'→'; position:absolute; top:50%; right:-14px; color:#A4AEBE; transform:translateY(-50%); }
.fund-lane .flow-node { border-color:#CEEDE6; background:#EFFAF7; }
.flow-connections { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); min-height:38px; }
.flow-connections div { display:grid; justify-items:center; color:var(--muted); font-size:10px; }
.flow-connections i { height:18px; border-left:1px dashed #AAB5C6; }
.flow-exceptions { display:flex; align-items:center; gap:9px; margin-top:12px; padding:10px 12px; border-left:3px solid var(--warning); background:#FFF8EB; color:#80580D; font-size:11px; }
@media (max-width:1240px) {
  .analysis-overview { grid-template-columns:1fr; }
}
```

补齐 `.analysis-section-head`、`.flow-head`、`.flow-body`、`.flow-label`、`.flow-legend` 的标题、间距和分隔线样式。不再使用原 `.analysis-kpis` 的 4 列大卡布局，也不再渲染原 `.lifecycle` 横条。

- [ ] **Step 7: 运行定向和全量验证**

Run:

```bash
node --test --test-name-pattern='channel analysis' tests/prototype.test.js
node --test tests/prototype.test.js
node tests/visual-check.js
git diff --check
```

Expected: 本次报表相关静态测试全部 PASS，全量测试不新增失败；Playwright 在 1440px 与 1024px 断言通过；生成两张合并页截图；浏览器无 JavaScript 或 console error。

### Task 4: 完成视觉审核和交付边界检查

**Files:**
- Verify: `admin.html`
- Verify: `docs/拾马商城后台一期PRD.md`
- Verify: `tests/prototype.test.js`
- Verify: `tests/visual-check.js`
- Generate: `artifacts/admin-channel-analysis-mini.png`
- Generate: `artifacts/admin-channel-analysis-api.png`

**Interfaces:**
- Consumes: Tasks 1-3 的完整合并页。
- Produces: 可复现测试记录、两个 Tab 的视觉证据和未提交变更摘要。

- [ ] **Step 1: 运行全量自动化验证**

Run:

```bash
node --test tests/prototype.test.js
node tests/visual-check.js
```

Expected: 本次报表相关测试全部通过，全量测试不新增失败，且脚本在 `artifacts/` 写入小程序与 API 两张新截图。

- [ ] **Step 2: 人工审查小程序 Tab 截图**

打开 `artifacts/admin-channel-analysis-mini.png`，确认：

- Tab 位于报表最上方，当前客户类型清晰。
- 8 个指标全部在左侧两列区域内，没有文字遮挡。
- 双轨图在右侧，订单流、资金流、竖向对应和异常摘要均可读。
- 首屏不再存在独占整行的指标卡组和重复闭环面板。

- [ ] **Step 3: 人工审查 API Tab 截图**

打开 `artifacts/admin-channel-analysis-api.png`，确认：

- 无消费积分、冻结积分或积分结算文案。
- 存在采购成功率、客户待回款、上游账户余额和余额差异。
- 双轨图的资金节点是余额/授信占用、采购支出、客户出账、回款/余额校对。
- 布局高度与小程序 Tab 接近，切换时不产生明显页面跳动。

- [ ] **Step 4: 执行最终静态边界检查**

Run:

```bash
rg -n 'data-view="mini-analysis"|data-view="api-analysis"' admin.html tests docs/拾马商城后台一期PRD.md
rg -n 'data-view="channel-analysis"|data-analysis-tab|data-dual-track-flow' admin.html tests
git diff --check
git status --short
```

Expected:

- 第一条 `rg` 无匹配。
- 第二条 `rg` 在 `admin.html`、`tests/prototype.test.js` 和 `tests/visual-check.js` 均有匹配。
- `git diff --check` 无输出。
- `git status --short` 只显示用户原有未跟踪文件与本次修改，不出现意外文件删除。

- [ ] **Step 5: 交付摘要，保留 Git 授权门**

最终回复只声明已完成的静态原型、文档和测试结果，并明确说明未实现真实报表 API、数据库聚合、下钻或导出任务。未获得新授权时不执行 `git add`、`git commit` 或 `git push`。
