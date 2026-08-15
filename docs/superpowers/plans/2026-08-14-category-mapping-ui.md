# 分类映射工作台 UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将现有左右双树分类映射工作台改为按供货平台页签隔离的查询表格，支持单条映射、解除、历史查看、增量导入预览及未映射商品跳转闭环。

**Architecture:** 分类映射页面只管理“来源二级分类到平台二级分类”的当前关系。静态原型使用独立映射状态与来源商品状态模拟动态分类解析，不在集采商品数据中写入迁移结果；供货平台页签、查询、单条编辑、导入预览和来源商品跳转均在现有 `admin.html` 单页结构中实现。

**Tech Stack:** 纯 HTML、CSS、原生 JavaScript、Node.js `node:test`、Playwright。

## Global Constraints

- 只映射来源二级分类，来源一级分类不保存映射。
- 一个来源二级分类最多映射一个平台二级分类；一个平台二级分类可关联多个来源分类。
- 页面按供货平台页签隔离，不提供跨平台页面操作。
- 页面只做查看和单条手工修改，批量调整仅通过当前平台增量导入。
- 映射状态只保留已映射、未映射；来源失效是独立状态。
- 修改或解除映射不迁移集采商品表。
- 未映射商品统一在供货平台来源商品页查看。
- 查询表单只保留查询字段、查询和重置按钮。
- 当前仓库无提交历史且未授权 Git 提交，不执行提交或推送。

---

### Task 1: 建立分类映射新工作台行为契约

**Files:**
- Modify: `tests/prototype.test.js`
- Modify: `tests/visual-check.js`

**Interfaces:**
- Consumes: 现有 `category-mapping`、`supplier-source-products` 页面。
- Produces: `data-mapping-supplier-tab`、`data-mapping-row`、`data-mapping-edit`、`data-mapping-modal`、`data-mapping-import`、`data-mapping-product-link` 行为契约。

- [x] **Step 1: 更新静态结构测试**

增加断言：

```js
for (const marker of [
  'data-mapping-supplier-tab',
  'data-mapping-row',
  'data-mapping-edit',
  'data-mapping-modal',
  'data-mapping-import',
  'data-mapping-product-link'
]) assert.match(html, new RegExp(marker));
```

- [x] **Step 2: 更新页面布局浏览器测试**

进入分类映射后验证：

```js
const tabLabels = await admin.locator('[data-mapping-supplier-tab]').allInnerTexts();
if (!tabLabels.some(text => text.includes('京选集采')) || !tabLabels.some(text => text.includes('企采云'))) {
  throw new Error('Supplier mapping tabs are incomplete');
}
const pageText = await admin.locator('#content').innerText();
for (const removedText of ['映射工作区', '待确认', '冲突', '批量映射', '保存映射']) {
  if (pageText.includes(removedText)) throw new Error(`Mapping page still exposes ${removedText}`);
}
```

同时验证表头包含来源分类编码、来源分类路径、有效商品数、目标平台分类、映射状态、来源状态、更新时间和操作。

- [x] **Step 3: 增加单条映射与解除测试**

点击未映射行的设置映射，验证弹窗只允许选择平台二级分类；保存后行状态变为已映射。再次打开修改弹窗，点击解除并确认，验证行恢复未映射。

- [x] **Step 4: 增加平台页签和查询重置测试**

切换到企采云后验证列表只出现企采云来源分类；设置映射状态和来源状态后查询，重置恢复默认条件并停留在当前平台页签。

- [x] **Step 5: 增加导入预览与来源商品跳转测试**

验证导入弹窗依次显示上传、预览统计、执行结果；点击有效商品数进入来源商品页，并确认供货平台、来源分类和待映射条件已带入。

- [x] **Step 6: 运行测试确认红灯**

Run:

```bash
node --test tests/prototype.test.js
NODE_PATH='/Users/xukai/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules' \
'/Users/xukai/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node' tests/visual-check.js
```

Expected: 静态测试因缺少新标记失败；浏览器测试因仍是左右双树工作台失败。

### Task 2: 同步 PRD 与现行规格

**Files:**
- Modify: `docs/拾马商城后台一期PRD.md`
- Modify: `docs/superpowers/specs/2026-08-14-channel-modules-and-catalog-design.md`
- Modify: `docs/superpowers/specs/2026-08-14-category-mapping-workflow-design.md`

**Interfaces:**
- Consumes: `2026-08-14-category-mapping-workflow-design.md` 已确认规则。
- Produces: 与新 UI 无冲突的当前 PRD 和规格状态。

- [x] **Step 1: 更新 PRD 分类映射职责**

补充供货平台页签、表格字段、两种映射状态、单条编辑、解除影响和未映射商品跳转。

- [x] **Step 2: 更新导入与审计规则**

写明单平台增量导入、预览确认、部分成功、失败明细、导入记录和历史审计。

- [x] **Step 3: 更新动态分类解析规则**

写明集采商品通过来源分类与映射动态解析平台分类，修改映射只更新映射关系和缓存版本，不迁移商品表。

### Task 3: 实现供货平台页签与映射查询表格

**Files:**
- Modify: `admin.html`

**Interfaces:**
- Produces: `mappingSuppliers`、`mappingRows`、`mappingViewState`、`categoryMappingPage()`。
- Consumes: `categoryData` 平台两级分类、统一 `queryToolbar()` 和 `pagination()`。

- [x] **Step 1: 建立映射页面静态状态模型**

```js
const mappingViewState = {
  supplierId: 'JX',
  keyword: '',
  mappingStatus: 'ALL',
  sourceStatus: 'ALL'
};
```

`mappingRows` 每行包含 `supplierId`、`sourceCategoryId`、`sourceCode`、`sourcePath`、`productCount`、`platformCategoryId`、`sourceStatus`、`rowVersion` 和 `updatedAt`。

- [x] **Step 2: 替换现有左右双树页面**

渲染：页面灰色说明、导入记录/导出/导入操作、供货平台页签、统一查询表单、映射表格和分页。删除映射工作区、待确认、冲突、批量映射和保存映射入口。

- [x] **Step 3: 绑定平台页签与查询重置**

页签切换清空查询条件并查询当前平台第 1 页。查询按关键字、映射状态和来源状态过滤；重置保留当前平台页签，恢复默认条件和第 1 页。

- [x] **Step 4: 实现商品数跳转**

`data-mapping-product-link` 设置来源商品页状态：

```js
Object.assign(supplierSourceViewState, {
  supplierId: row.supplierId,
  platformName: supplier.name,
  sourceCategoryId: row.sourceCategoryId,
  sourceCategoryPath: row.sourcePath,
  aggregationStatus: row.platformCategoryId ? 'ALL' : '待映射'
});
render('supplier-source-products');
```

### Task 4: 实现单条映射、解除与历史弹窗

**Files:**
- Modify: `admin.html`

**Interfaces:**
- Consumes: `mappingRows`、`categoryData`、`mappingViewState`。
- Produces: `openMappingEditor()`、`saveMappingEditor()`、`requestUnbindMapping()`、`confirmUnbindMapping()`、`openMappingHistory()`。

- [x] **Step 1: 构建映射编辑弹窗**

展示来源信息、当前目标、有效商品数和影响提示；使用平台一级、二级分类级联选择，二级分类只包含启用分类。

- [x] **Step 2: 保存单条映射**

保存时校验来源状态和目标分类，更新当前行 `platformCategoryId`、`rowVersion`、`updatedAt`，追加静态历史记录并重新渲染当前平台。

- [x] **Step 3: 实现解除二次确认**

在弹窗中切换到解除确认视图，明确商品退出商品管理和进入待映射视图；确认后清空当前映射并追加解除历史。

- [x] **Step 4: 实现历史视图**

查看历史展示操作类型、修改前后分类、操作来源、操作人、时间和受影响商品数。

### Task 5: 实现增量导入原型与来源商品筛选闭环

**Files:**
- Modify: `admin.html`

**Interfaces:**
- Produces: `mappingImportState`、`openMappingImport()`、`previewMappingImport()`、`executeMappingImport()`。
- Modifies: `supplierSourceProductsPage()` 支持平台、来源分类和归集状态预设。

- [x] **Step 1: 构建三阶段导入弹窗**

上传阶段显示当前供货平台、增量语义、模板下载和文件输入；预览阶段显示新增、修改、解除、无变化、失败和受影响商品数；执行阶段显示部分成功结果和失败明细下载。

- [x] **Step 2: 模拟导入预览与部分成功**

静态原型使用确定样例生成 `3` 条成功、`1` 条失败，失败原因为重复来源分类或目标分类停用；执行后显示成功/失败汇总，不渲染跨平台操作。

- [x] **Step 3: 增加导入记录入口**

导入记录展示当前平台的任务编号、文件名、操作人、执行时间、成功数、失败数和状态。

- [x] **Step 4: 改造来源商品查询状态**

来源商品页显示当前供货平台、来源分类和归集状态预设；支持从分类映射页进入后返回当前筛选上下文。

### Task 6: 完成回归、截图与规格收口

**Files:**
- Modify: `docs/superpowers/specs/2026-08-14-category-mapping-workflow-design.md`
- Modify: `docs/superpowers/plans/2026-08-14-category-mapping-ui.md`
- Generate: `artifacts/admin-category-mapping.png`
- Generate: `artifacts/admin-category-mapping-edit.png`
- Generate: `artifacts/admin-category-mapping-import.png`
- Generate: `artifacts/admin-supplier-source-products.png`

**Interfaces:**
- Consumes: 完成后的映射工作台和来源商品跳转。
- Produces: 自动化证据、截图和已实施文档状态。

- [x] **Step 1: 运行静态测试**

Run: `node --test tests/prototype.test.js`

Expected: 全部通过。

- [x] **Step 2: 运行完整浏览器回归**

Run:

```bash
NODE_PATH='/Users/xukai/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules' \
'/Users/xukai/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node' tests/visual-check.js
```

Expected: 分类映射新交互和既有后台、小程序流程全部通过。

- [x] **Step 3: 检查截图**

检查平台页签、查询表格、单条编辑、解除提示、导入预览和来源商品筛选跳转；确认不出现左右双树、待确认、冲突或页面批量映射。

- [x] **Step 4: 更新实施状态与计划勾选**

将设计状态更新为“方案与 UI 已实施”，勾选完成步骤。

- [x] **Step 5: 最终一致性扫描**

```bash
rg -n '映射工作区|待确认|批量映射|保存映射' admin.html docs/拾马商城后台一期PRD.md
rg -n 'data-mapping-supplier-tab|data-mapping-row|data-mapping-modal|data-mapping-import' admin.html
rg -n '^- \[ \]' docs/superpowers/plans/2026-08-14-category-mapping-ui.md
```

Expected: 原型和当前 PRD 不含旧工作台交互；新标记存在；计划无未完成步骤。
