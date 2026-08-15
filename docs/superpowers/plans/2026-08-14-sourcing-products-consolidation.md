# 集采商品收拢至商品管理 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 删除独立“集采商品”菜单，将已归集集采商品并入商品管理单列表，通过商品来源下拉筛选，并把未归集来源商品入口迁至供货平台详情。

**Architecture:** 保留平台商品与来源商品两套底层对象。`products` 页面继续以平台 SPU/SKU 为主，新增来源筛选；原 `sourcing-products` 导航删除并作为兼容入口重定向到集采来源筛选。来源原始数据使用供货平台内部详情页展示，不进入商品管理，也不增加投放开关。

**Tech Stack:** 纯 HTML、CSS、原生 JavaScript、Node.js `node:test`、Playwright。

## Global Constraints

- 商品管理只展示自营商品和已进入平台商品库的集采商品。
- 未映射、未归集的来源商品不进入商品管理。
- 商品管理保持单列表，不增加来源类型页签。
- 本次不新增、不迁移、不合并企业级、分类级或商品级投放开关。
- 集采成本和库存只读，自营成本和库存继续由平台维护。
- 原 `sourcing-products` 菜单权限迁移为 `products`；一期不增加数据范围或按钮权限。
- 当前仓库没有提交历史且未授权 Git 提交，不执行提交或推送。

---

### Task 1: 建立收拢后的行为契约

**Files:**
- Modify: `tests/prototype.test.js`
- Modify: `tests/visual-check.js`

**Interfaces:**
- Consumes: `products`、`suppliers`、`system-roles` 现有页面。
- Produces: `data-product-source`、`data-supplier-sources`、`data-supplier-source-page`、`data-supplier-source-back` 的行为契约。

- [x] **Step 1: 更新静态导航契约**

修改导航测试：

```js
assert.doesNotMatch(html, /data-view="sourcing-products"/);
assert.match(html, /data-product-source/);
assert.match(html, /data-supplier-sources/);
assert.match(html, /data-supplier-source-page/);
```

“集采商品”仍允许作为来源筛选选项和业务文案存在，但不能再作为 `data-view="sourcing-products"` 导航。

- [x] **Step 2: 更新商品管理浏览器测试**

在进入商品管理后验证：

```js
const sourceSelect = admin.locator('[data-product-source]');
if (await sourceSelect.count() !== 1) throw new Error('Product source filter is missing');
await sourceSelect.selectOption('集采');
await admin.click('[data-query-submit]');
const sourcingRows = await admin.locator('[data-product-row]').allInnerTexts();
if (!sourcingRows.length || sourcingRows.some(text => !text.includes('集采'))) {
  throw new Error('Product source filter includes non-sourcing products');
}
if (sourcingRows.some(text => text.includes('未映射'))) {
  throw new Error('Unmapped source products leaked into product management');
}
await admin.click('[data-query-reset]');
if (await sourceSelect.inputValue() !== 'all') throw new Error('Reset did not restore all sources');
```

同时验证商品管理没有来源类型页签，也没有小程序/API 商品展示开关。

- [x] **Step 3: 更新供货平台来源商品测试**

删除对独立 `sourcing-products` 页面的点击，改为：

```js
await admin.click('[data-view="suppliers"]');
await admin.click('[data-supplier-sources="京选集采"]');
const sourcePage = admin.locator('[data-supplier-source-page]');
for (const text of ['来源商品编码', '来源分类', '平台商品归集状态', '待映射']) {
  if (!(await sourcePage.innerText()).includes(text)) throw new Error(`Supplier source page is missing ${text}`);
}
if ((await sourcePage.innerText()).includes('小程序展示') || (await sourcePage.innerText()).includes('API展示')) {
  throw new Error('Supplier source products still expose delivery switches');
}
await admin.click('[data-supplier-source-back]');
```

- [x] **Step 4: 更新角色权限迁移测试**

打开 `ROLE-OPS` 后验证 `products` 已勾选，且权限树中不存在 `sourcing-products`：

```js
if (!(await admin.locator('[data-permission-child="products"]').isChecked())) {
  throw new Error('Supply operations role did not inherit product management');
}
if (await admin.locator('[data-permission-child="sourcing-products"]').count()) {
  throw new Error('Removed sourcing products permission still exists');
}
```

- [x] **Step 5: 运行测试确认红灯**

Run:

```bash
node --test tests/prototype.test.js
NODE_PATH='/Users/xukai/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules' \
'/Users/xukai/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node' tests/visual-check.js
```

Expected: 静态测试因旧导航仍存在失败；浏览器测试因缺少商品来源下拉或供货平台来源商品入口失败。

### Task 2: 同步 PRD 与既有规格

**Files:**
- Modify: `docs/拾马商城后台一期PRD.md`
- Modify: `docs/superpowers/specs/2026-08-14-channel-modules-and-catalog-design.md`
- Modify: `docs/superpowers/specs/2026-08-14-product-category-tree-layout-design.md`
- Modify: `docs/superpowers/specs/2026-08-14-query-list-page-standard-design.md`
- Modify: `docs/superpowers/specs/2026-08-14-category-tree-table-design.md`

**Interfaces:**
- Consumes: `docs/superpowers/specs/2026-08-14-sourcing-products-consolidation-design.md`。
- Produces: 无独立集采商品菜单或商品开关迁移冲突的当前需求文档。

- [x] **Step 1: 更新菜单树与验收标准**

将供货平台管理菜单收敛为“供货平台、分类映射”，删除所有将“集采商品”描述为独立菜单的当前需求条目。

- [x] **Step 2: 更新商品管理定义**

写明单列表、商品来源下拉、只展示已归集商品、自营与集采字段差异、重置保留分类，以及不新增投放开关。

- [x] **Step 3: 更新供货平台详情定义**

增加“来源商品”详情页签，字段为来源编码、来源分类、来源 SKU、最新采购价、库存、分类映射、平台商品归集状态和同步结果；只提供查看、重新同步和查看映射结果。

- [x] **Step 4: 更新权限与兼容规则**

写明旧权限迁移至 `products`、旧地址跳转商品管理并预设集采来源筛选，以及存量来源数据和投放配置不删除。

### Task 3: 实现统一商品来源筛选

**Files:**
- Modify: `admin.html`

**Interfaces:**
- Consumes: `rows.products`、`productViewState`、`filterProductRows()`、`productPage()`。
- Produces: `productViewState.source`、`data-product-source` 和包含来源平台列的统一商品列表。

- [x] **Step 1: 补充平台商品来源字段**

将 `rows.products[*].cells` 调整为：

```text
商品编码、商品名称、平台分类、SKU数、商品来源、来源平台、成本价/采购价、库存、状态
```

自营商品来源平台显示“平台自营”，集采商品显示对应供货平台。

- [x] **Step 2: 增加来源查询状态和过滤**

```js
const productViewState = {
  selectedCategoryId: 'all',
  expandedCategoryIds: new Set(['office']),
  keyword: '',
  source: 'all',
  status: 'all'
};
```

`filterProductRows()` 增加：

```js
const sourceMatch = productViewState.source === 'all' || product.cells[4] === productViewState.source;
return categoryMatch && keywordMatch && sourceMatch && statusMatch;
```

- [x] **Step 3: 增加普通来源下拉框**

在右侧查询表单增加：

```html
<select class="field" data-product-source>
  <option value="all">全部来源</option>
  <option value="自营">自营商品</option>
  <option value="集采">集采商品</option>
</select>
```

不得增加来源类型页签。

- [x] **Step 4: 绑定查询和重置**

查询时保存 `data-product-source`；重置时将 `source` 恢复为 `all`，同时保留当前分类并回到第 1 页。

- [x] **Step 5: 保持来源差异操作**

自营商品操作展示编辑、查看 SKU、下架；集采商品操作展示查看详情、查看 SKU、同步信息、下架。统一列表中不渲染小程序展示或 API 展示开关。

### Task 4: 迁移来源商品入口与菜单权限

**Files:**
- Modify: `admin.html`

**Interfaces:**
- Consumes: `suppliersPage()`、原 `sourcingProductsPage()` 数据样例、`adminMenuTree`、`systemRoles`、`render(view)`。
- Produces: `supplierSourceState`、`supplierSourceProductsPage()`、`data-supplier-sources`、`data-supplier-source-page`、`data-supplier-source-back`。

- [x] **Step 1: 删除独立菜单和权限节点**

- 删除侧边导航 `data-view="sourcing-products"`。
- 从 `adminMenuTree.supply.children` 删除 `sourcing-products`。
- 将 `ROLE-OPS.menuCodes` 中的 `sourcing-products` 替换为 `products`。

- [x] **Step 2: 增加供货平台来源商品入口**

在每个供货平台行操作栏增加：

```html
<button class="link" data-supplier-sources="京选集采">来源商品</button>
```

- [x] **Step 3: 将原来源数据改为内部详情页**

`supplierSourceProductsPage()` 展示选中供货平台、返回入口、来源分类与来源商品表格。移除小程序/API开关列，增加“平台商品归集状态”和“最近同步”。示例中至少包含已归集、待映射、待归集三种状态。

- [x] **Step 4: 注册内部路由与返回行为**

- `data-supplier-sources` 设置 `supplierSourceState.platformName` 后渲染 `supplier-source-products`。
- 进入内部页时左侧“供货平台”菜单保持选中，面包屑显示“供货平台 / 来源商品”。
- `data-supplier-source-back` 返回 `suppliers`。

- [x] **Step 5: 保留旧入口兼容**

`render('sourcing-products')` 时转换为：

```js
productViewState.source = '集采';
render('products');
```

旧入口不再渲染独立页面。

### Task 5: 完成回归与规格收口

**Files:**
- Modify: `docs/superpowers/specs/2026-08-14-sourcing-products-consolidation-design.md`
- Modify: `docs/superpowers/plans/2026-08-14-sourcing-products-consolidation.md`
- Generate: `artifacts/admin-products.png`
- Generate: `artifacts/admin-supplier-source-products.png`
- Generate: `artifacts/admin-system-role-permissions.png`

**Interfaces:**
- Consumes: 完成后的商品管理、供货平台来源商品和角色菜单树。
- Produces: 自动化证据、截图及已实施文档状态。

- [x] **Step 1: 运行静态测试**

Run: `node --test tests/prototype.test.js`

Expected: 全部静态测试通过。

- [x] **Step 2: 运行浏览器回归**

Run:

```bash
NODE_PATH='/Users/xukai/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules' \
'/Users/xukai/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node' tests/visual-check.js
```

Expected: 商品来源筛选、来源商品入口、权限迁移及既有后台/小程序回归全部通过。

- [x] **Step 3: 检查截图**

检查商品管理单列表、来源下拉和来源平台字段；检查供货平台来源商品内部页无投放开关；检查角色权限树中商品管理已勾选且集采商品节点消失。

- [x] **Step 4: 更新规格状态与计划勾选**

将设计状态改为“方案已确认，原型已实施”，勾选已完成步骤。

- [x] **Step 5: 最终一致性扫描**

Run:

```bash
rg -n 'data-view="sourcing-products"|data-permission-child="sourcing-products"' admin.html
rg -n '供货平台管理.*集采商品|独立菜单.*集采商品' docs/拾马商城后台一期PRD.md docs/superpowers/specs
rg -n 'data-product-source|data-supplier-sources|data-supplier-source-page' admin.html
```

Expected: 前两个命令不出现仍生效的旧菜单/权限定义；三个新页面标记均存在。
