# 商品管理分类树主从布局 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将后台“商品管理”改为左侧平台两级分类树、右侧商品查询列表的主从页面，并实现分类选择、展开、筛选、重置和分页状态联动。

**Architecture:** 保留单文件静态原型结构，在 `admin.html` 中为商品管理增加独立的 `productPage()` 渲染器和商品页状态，不改变其他通用列表页。分类树复用 `categoryData`，商品静态数据增加分类 ID，右侧列表根据选中节点的 `ALL`、`WITH_DESCENDANTS`、`DIRECT` 语义过滤。

**Tech Stack:** 纯 HTML、CSS、原生 JavaScript、Node.js `node:test`、Playwright。

## Global Constraints

- 平台分类保持两级结构，左侧顶部固定“全部”节点。
- 一级分类查询包含其全部二级分类商品，二级分类只查询直属商品。
- 展开箭头与分类选择分离，点击箭头不得改变当前分类或刷新商品列表。
- 右侧查询表单只保留查询字段、“查询”和“重置”。
- 重置清空右侧临时条件、保留左侧分类，并返回第 1 页。
- 保留灰色页面提示词、平台兜底加价、导出和新建自营商品入口。
- 不改商品、SKU、成本、库存和定价的底层数据逻辑。
- 当前仓库尚无提交历史且未取得 Git 提交授权；计划步骤不执行 `git add`、`git commit` 或推送。

---

### Task 1: 建立商品分类树静态与文档契约

**Files:**
- Modify: `tests/prototype.test.js`
- Modify: `docs/拾马商城后台一期PRD.md`

**Interfaces:**
- Consumes: 已确认设计文档中的页面结构和查询口径。
- Produces: 商品页 DOM 标记 `data-product-layout`、`data-product-category`、`data-product-current-category`、`data-product-tree-toggle` 的静态契约，以及 PRD 中一致的规则描述。

- [x] **Step 1: 先写失败的静态测试**

在 `tests/prototype.test.js` 新增测试，要求后台原型包含商品分类树主从布局标记、默认“全部”、当前分类同步区域，并要求 PRD 明确一级包含下级、二级直属和重置保留分类：

```js
test('product management uses the approved category tree master-detail layout', () => {
  const html = read('admin.html');
  for (const marker of [
    'data-product-layout',
    'data-product-category="all"',
    'data-product-current-category',
    'data-product-tree-toggle'
  ]) assert.match(html, new RegExp(marker));
  assert.match(html, /当前分类/);

  const prd = read('docs/拾马商城后台一期PRD.md');
  for (const rule of [
    '左侧分类树',
    '一级分类及其全部二级分类',
    '二级分类直属商品',
    '保留当前分类'
  ]) assert.match(prd, new RegExp(rule));
});
```

- [x] **Step 2: 运行静态测试并确认失败原因**

Run: `node --test tests/prototype.test.js`

Expected: FAIL，首个失败项为 `admin.html` 缺少 `data-product-layout`，证明测试捕获的是未实现功能。

- [x] **Step 3: 更新 PRD 的商品管理定义**

在 `docs/拾马商城后台一期PRD.md` 的“7.2 商品管理”中补充：

```markdown
- 页面采用左侧分类树、右侧商品列表的主从布局；左侧固定“全部”节点并默认选中。
- 选择一级分类时查询该一级分类及其全部二级分类商品；选择二级分类时仅查询二级分类直属商品。
- 右侧查询区同步展示当前分类；分类切换、查询和重置后页码回到第 1 页。
- 重置清空右侧临时查询条件，但保留当前分类选择。
```

- [x] **Step 4: 保持静态测试处于预期失败状态**

Run: `node --test tests/prototype.test.js`

Expected: FAIL，PRD 规则已经命中，但 `admin.html` 仍缺少商品页 DOM 标记。

### Task 2: 建立商品分类树浏览器行为契约

**Files:**
- Modify: `tests/visual-check.js`

**Interfaces:**
- Consumes: Task 1 规定的 DOM 标记。
- Produces: 分类初始化、一级/二级查询、箭头隔离和重置行为的端到端回归测试。

- [x] **Step 1: 先写失败的浏览器交互测试**

扩展 `tests/visual-check.js` 中商品管理检查：

```js
await admin.click('[data-view="products"]');
if (!(await admin.locator('[data-product-category="all"]').evaluate(el => el.classList.contains('active')))) {
  throw new Error('Product category tree does not default to All');
}
if ((await admin.locator('[data-product-current-category]').innerText()).trim() !== '全部') {
  throw new Error('Product query form does not show the default category');
}

await admin.click('[data-product-category="digital"]');
const parentRows = await admin.locator('[data-product-row]').allInnerTexts();
if (!parentRows.some(text => text.includes('无线蓝牙键盘')) || !parentRows.some(text => text.includes('便携充电宝'))) {
  throw new Error('Level-one category does not include all descendant products');
}

await admin.click('[data-product-tree-toggle="digital"]');
await admin.click('[data-product-category="digital-keyboard"]');
const childRows = await admin.locator('[data-product-row]').allInnerTexts();
if (!childRows.some(text => text.includes('无线蓝牙键盘')) || childRows.some(text => text.includes('便携充电宝'))) {
  throw new Error('Level-two category does not limit products to direct members');
}

await admin.locator('[data-query-form] input').fill('临时条件');
await admin.click('[data-page="2"]');
await admin.click('[data-query-reset]');
if ((await admin.locator('[data-product-current-category]').innerText()).trim() !== '键鼠外设') {
  throw new Error('Product query reset did not preserve the selected category');
}
if (await admin.locator('[data-query-form] input').inputValue() !== '') {
  throw new Error('Product query reset did not clear the keyword');
}
if (!(await admin.locator('[data-page="1"]').evaluate(el => el.classList.contains('active')))) {
  throw new Error('Product query reset did not return to page 1');
}
```

- [x] **Step 2: 运行浏览器测试并确认失败原因**

Run: `node tests/visual-check.js`

Expected: FAIL，错误为找不到 `[data-product-category="all"]` 或商品页仍使用通用单列列表。

### Task 3: 实现商品管理主从布局和交互

**Files:**
- Modify: `admin.html`

**Interfaces:**
- Consumes: `categoryData` 两级分类、`meta.products` 表头、商品静态数据。
- Produces: `productPage()`、`renderProductCategoryTree()`、`selectProductCategory(categoryId)` 和商品页专用查询状态。

- [x] **Step 1: 增加主从布局样式**

在现有 `.tree-layout` 样式附近增加商品页专用样式：

```css
.product-catalog-layout { display:grid; grid-template-columns:240px minmax(0,1fr); gap:14px; align-items:start; }
.product-category-tree { min-height:590px; padding:12px; background:white; border:1px solid var(--line); border-radius:var(--radius); }
.product-category-node { width:100%; min-height:36px; display:flex; align-items:center; gap:7px; padding:0 9px; border:0; border-radius:6px; color:var(--ink); background:transparent; cursor:pointer; text-align:left; }
.product-category-node:hover { background:#F6F8FC; }
.product-category-node.active { color:var(--brand-dark); background:#EEF2FF; font-weight:700; }
.product-category-child { padding-left:31px; }
.product-tree-row { display:grid; grid-template-columns:24px minmax(0,1fr); align-items:center; gap:2px; }
.product-tree-expander { width:24px; height:24px; display:grid; place-items:center; border:0; border-radius:5px; color:var(--muted); background:transparent; cursor:pointer; }
.product-current-category { display:inline-flex; align-items:center; min-height:36px; padding:0 11px; color:var(--muted); background:#F6F8FC; border-radius:7px; white-space:nowrap; }
```

在已有桌面响应式规则中保证 1024px 仍保持两栏，窄于后台支持范围时让右侧表格容器内部滚动，不允许页面根节点横向溢出。

- [x] **Step 2: 为商品数据补充分类归属**

将 `rows.products` 改为包含 `categoryId`、`parentCategoryId` 和 `cells` 的对象数组。例如：

```js
{ categoryId:'digital-keyboard', parentCategoryId:'digital', cells:['SPU-10284','无线蓝牙键盘 K3','数码家电 / 键鼠外设','2','集采','¥ 176.00','83','正常'] }
```

其余商品分别绑定 `bags-backpack`、`office-consumables`、`daily-cups`、`digital-power`，确保一级和二级筛选都有可验证数据。

- [x] **Step 3: 增加商品页独立状态与分类树渲染**

在 `categoryData` 后增加：

```js
const productViewState = {
  selectedCategoryId: 'all',
  expandedCategoryIds: new Set(['office']),
  keyword: '',
  status: 'all'
};
```

实现 `renderProductCategoryTree()`：固定渲染 `data-product-category="all"`，一级节点使用独立的 `data-product-tree-toggle` 和 `data-product-category`，二级节点放入可隐藏的 `data-product-tree-children` 容器。选中态只由 `selectedCategoryId` 决定。

- [x] **Step 4: 增加商品筛选和右侧页面渲染**

实现 `getSelectedProductCategory()` 和 `filterProductRows()`：

```js
function filterProductRows() {
  return rows.products.filter(product => {
    const categoryMatch = productViewState.selectedCategoryId === 'all'
      || product.categoryId === productViewState.selectedCategoryId
      || product.parentCategoryId === productViewState.selectedCategoryId;
    const keyword = productViewState.keyword.toLowerCase();
    const keywordMatch = !keyword || product.cells.slice(0, 3).join(' ').toLowerCase().includes(keyword);
    const statusMatch = productViewState.status === 'all' || product.cells.at(-1) === productViewState.status;
    return categoryMatch && keywordMatch && statusMatch;
  });
}
```

实现 `productPage()`，页面结构必须为：页面提示和操作区 → `data-product-layout` 两栏 → 左侧分类树 → 右侧 `data-query-form`、当前分类、商品表格和分页。商品行增加 `data-product-row`。

- [x] **Step 5: 绑定分类、查询和重置交互**

将 `products: productPage` 注册到 `pageRenderers`。在 `render(view)` 中：

- 商品页点击分类名称时更新 `selectedCategoryId` 并重新渲染商品页，因此自动回到第 1 页。
- 点击 `data-product-tree-toggle` 时只切换对应二级容器的 `hidden` 和箭头状态，不调用 `render()`。
- 商品页点击“查询”时读取 keyword/status 到 `productViewState`，重新渲染并回到第 1 页。
- 商品页点击“重置”时只清空 keyword/status，保留 `selectedCategoryId`，重新渲染并回到第 1 页。
- 其他列表继续沿用原有通用查询和重置事件。

- [x] **Step 6: 运行静态测试并确认转绿**

Run: `node --test tests/prototype.test.js`

Expected: PASS，全部静态测试通过。

- [x] **Step 7: 运行浏览器交互测试并修复到转绿**

Run: `node tests/visual-check.js`

Expected: PASS，输出 `visual-check: admin navigation/pagination and miniapp redemption flow passed`，并更新 `artifacts/admin-products.png`。

### Task 4: 完整回归与规格状态收口

**Files:**
- Modify: `docs/superpowers/specs/2026-08-14-product-category-tree-layout-design.md`
- Modify: `docs/superpowers/plans/2026-08-14-product-category-tree-layout.md`

**Interfaces:**
- Consumes: Task 1-3 的最终实现和测试证据。
- Produces: 已实施状态的设计文档、完成勾选的实施计划和可交付验证结果。

- [x] **Step 1: 更新设计文档状态**

将设计文档顶部状态改为：

```markdown
状态：方案已确认，原型已实施
```

- [x] **Step 2: 检查旧单列商品页面和查询规范回归**

Run:

```bash
rg -n 'data-product-layout|data-product-category="all"|data-product-current-category|data-product-tree-toggle' admin.html
rg -n '左侧分类树|一级分类及其全部二级分类|二级分类直属商品|保留当前分类' docs/拾马商城后台一期PRD.md
rg -n 'class="table-summary"|更多筛选|>筛选<' admin.html && exit 1 || true
```

Expected: 前两条均有结果，第三条无旧规范命中。

- [x] **Step 3: 运行完整验证**

Run:

```bash
node --test tests/prototype.test.js
node tests/visual-check.js
git diff --check
```

Expected: 静态测试零失败、浏览器测试通过、`git diff --check` 零错误。

- [x] **Step 4: 勾选计划完成项并核对无遗漏**

将本计划所有步骤改为 `[x]`，然后运行：

```bash
test -z "$(rg '^- \[ \]' docs/superpowers/plans/2026-08-14-product-category-tree-layout.md)"
```

Expected: exit code 0。
