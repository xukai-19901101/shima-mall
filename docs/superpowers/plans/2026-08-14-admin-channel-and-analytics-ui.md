# 拾马商城后台渠道模块与经营分析 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将最终确认的后台菜单、渠道双模块和两张渠道经营分析页沉淀到 PRD，并同步调整现有纯 HTML 后台原型。

**Architecture:** 保持 `admin.html` 单文件原型结构，导航使用固定 `data-view` 路由；列表页面继续复用 `listPage(view)`，渠道分析、分类映射和集采目录使用独立渲染函数。小程序与 API 页面只在展示配置上拆分，底层模拟数据结构仍按企业、订单、商品、账户等共用对象组织。

**Tech Stack:** Markdown、纯 HTML/CSS、原生 JavaScript、Node.js `node:test`、Playwright 浏览器检查。

## Global Constraints

- 企业渠道只能是 `MINIAPP` 或 `API`，创建后不可修改。
- 小程序渠道使用积分，API 渠道不进入积分体系。
- 商品库只设“分类管理、商品管理”两个菜单。
- 供货平台管理只设“供货平台、分类映射、集采商品”三个菜单。
- 经营看板增加“小程序商城分析、API供货分析”。
- 两个分析页都包含“订单与资金结算闭环、商品销量排行、企业贡献排行”。
- 保留内容页左上角灰色提示词；不恢复重复大标题、深色说明条和黄色提示块。
- 不修改 `miniapp.html`。
- 当前工作区文件均未跟踪，不在未获用户授权时执行 Git 提交。

---

### Task 1: PRD source of truth

**Files:**
- Create: `docs/拾马商城后台一期PRD.md`
- Modify: `docs/superpowers/specs/2026-08-14-channel-modules-and-catalog-design.md`

**Interfaces:**
- Consumes: 已确认的渠道不可变、对象化菜单和经营分析统计口径。
- Produces: 开发和 UI 评审统一使用的最终菜单、页面、字段、统计口径与验收标准。

- [x] **Step 1: 创建 PRD，写入最终菜单树**

PRD 必须包含以下菜单：

```text
经营看板/经营总览、小程序商城分析、API供货分析
小程序商城客户/小程序客户、商城订单、积分账户
API供货客户/API客户、API订单、资金对账
商品库/分类管理、商品管理
供货平台管理/供货平台、分类映射、集采商品
```

- [x] **Step 2: 写入两个渠道分析页的三个子表及统计口径**

两个页面均写明：订单与资金结算闭环、商品销量排行、企业贡献排行；说明小程序积分口径和 API 人民币/余额校对口径的差异。

- [x] **Step 3: 自检 PRD**

Run:

```bash
rg -n "TBD|TODO|待定|商品与供货|小程序 \+ API" docs/拾马商城后台一期PRD.md
```

Expected: 不出现占位词和旧菜单；“小程序 + API”只能出现在禁止组合渠道的规则说明中。

### Task 2: Failing prototype contract tests

**Files:**
- Modify: `tests/prototype.test.js`
- Modify: `tests/visual-check.js`

**Interfaces:**
- Consumes: PRD 最终菜单和页面名称。
- Produces: 后台静态合同与浏览器交互验收。

- [x] **Step 1: 修改静态测试，断言最终菜单与分析子表**

增加断言：

```javascript
for (const label of ['小程序商城分析', 'API供货分析', '小程序商城客户', 'API供货客户', '商品库', '供货平台管理']) {
  assert.match(html, new RegExp(label));
}
for (const label of ['分类管理', '商品管理', '供货平台', '分类映射', '集采商品']) {
  assert.match(html, new RegExp(label));
}
for (const label of ['订单与资金结算闭环', '商品销量排行', '企业贡献排行']) {
  assert.match(html, new RegExp(label));
}
```

并断言旧一级模块“企业管理、商品与供货、订单履约、账户结算”不再存在。

- [x] **Step 2: 运行测试确认失败**

Run: `node --test tests/prototype.test.js`

Expected: FAIL，缺少新菜单和分析页面。

- [x] **Step 3: 扩充视觉测试**

Playwright 依次点击两个分析页，校验三个子表均存在；点击商品库与供货平台管理所有菜单，校验面包屑和页面内容正确。

### Task 3: Final navigation and object pages

**Files:**
- Modify: `admin.html`

**Interfaces:**
- Consumes: `render(view)`、`listPage(view)`、`rows`、`meta`。
- Produces: 最终菜单路由和所有二级菜单的可展示页面。

- [x] **Step 1: 替换左侧导航**

新增固定路由：

```text
dashboard, mini-analysis, api-analysis
mini-enterprises, mini-orders, points-accounts
api-clients, api-orders, api-reconciliation
category, products
suppliers, category-mapping, sourcing-products
```

- [x] **Step 2: 拆分渠道列表模拟数据**

企业、订单和账户数据不再出现“小程序 + API”；小程序列表只展示积分字段，API 列表只展示人民币结算和接入字段。

- [x] **Step 3: 收拢商品库页面**

“商品管理”列表保留新建自营商品入口；成本和库存显示为商品/SKU字段与详情入口，不生成独立菜单。

- [x] **Step 4: 新增供货平台对象页面**

`suppliers` 展示平台连接、同步和两个渠道总开关；`category-mapping` 展示跨平台映射队列；`sourcing-products` 展示来源分类、商品明细和单品渠道开关。

### Task 4: Channel analysis reports

**Files:**
- Modify: `admin.html`

**Interfaces:**
- Consumes: 渠道订单、商品、企业和账户模拟数据。
- Produces: `channelAnalysisPage(channelType)`，返回两种渠道的经营分析页面。

- [x] **Step 1: 实现共用分析页面骨架**

分析页面接收 `MINIAPP` 或 `API`，共用时间筛选、KPI卡片、三个子表和下钻按钮。

- [x] **Step 2: 实现小程序统计口径**

展示有效订单、消费积分、结算金额、采购成本、毛利、冻结积分、预付余额和后结应收；闭环状态为提交、冻结、采购、扣减、履约和结算。

- [x] **Step 3: 实现 API 统计口径**

展示有效订单、结算额、采购成本、毛利、采购成功率、结果未知、待回款和余额差异；闭环状态为受理、采购、发货、完成、出账、回款和余额校对。

- [x] **Step 4: 实现排行表**

商品排行包含销量、结算金额、采购成本和毛利；企业排行包含订单、结算金额、毛利、贡献占比和渠道特有字段。

### Task 5: Verification and visual artifacts

**Files:**
- Modify: `tests/visual-check.js`
- Generate: `artifacts/admin-mini-analysis.png`
- Generate: `artifacts/admin-api-analysis.png`
- Generate: `artifacts/admin-products.png`
- Generate: `artifacts/admin-sourcing-products.png`

**Interfaces:**
- Consumes: 完成后的后台原型。
- Produces: 静态合同、浏览器交互和视觉验收证据。

- [x] **Step 1: 运行静态测试**

Run: `node --test tests/prototype.test.js`

Expected: 全部 PASS。

- [x] **Step 2: 运行浏览器测试**

Run:

```bash
NODE_PATH='/Users/xukai/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules' node tests/visual-check.js
```

Expected: 菜单、分页、小程序兑换流和新增后台页面全部通过，无运行时错误和横向溢出。

- [x] **Step 3: 检查生成截图**

确认两个分析页、商品管理和集采商品页面在 1440×1000 下信息层级清晰，左上角灰色提示词保留，无重复大标题和整块规则提示条。
