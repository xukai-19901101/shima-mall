# 分类映射树形对照页 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 用左右两棵两级分类树和带产品数量的关系线替换分类映射主表格，同时保留平台切换、查询、单条映射、历史、导入与来源商品下钻。

**Architecture:** 继续使用 `admin.html` 单文件静态原型。`categoryData` 生成左侧平台树，`filteredMappingRows()` 按来源路径分组生成右侧集采平台树，`drawMappingRelations()` 在渲染完成后根据节点位置生成只读 SVG 连线和数量标签。

**Tech Stack:** HTML5、CSS3、Vanilla JavaScript、Node.js `node:test`、Playwright、Google Chrome。

**执行状态：** 已完成；19 项静态测试和完整浏览器回归通过，未创建提交。

## Global Constraints

- 左侧必须是平台商品分类树，且不展示“全部”节点。
- 右侧必须是当前集采平台来源分类树。
- 箭头方向必须是“右侧来源二级分类 → 左侧平台二级分类”。
- 每条关系线中部显示该来源分类的产品数量。
- 不展示商品明细、商品图片或缩略图。
- 不新增拖拽、批量映射、冲突或待确认状态。
- 保留平台页签、查询表单、单条映射、历史、导入和来源商品下钻。
- 当前仓库无提交历史且文件均未跟踪；不创建提交、不清理用户文件。

---

### Task 1: 固化树形对照页面合约

**Files:**
- Modify: `tests/prototype.test.js`
- Modify: `tests/visual-check.js`
- Modify: `docs/拾马商城后台一期PRD.md`

**Interfaces:**
- Consumes: `data-mapping-supplier-tab`、`data-query-form`、既有映射弹窗合约。
- Produces: `data-mapping-compare`、`data-mapping-platform-tree`、`data-mapping-source-tree`、`data-mapping-relations`、`data-mapping-product-count`。

- [x] **Step 1: 修改静态合约**

让测试期待左右树、关系层和数量标签，并移除对分类映射主表表头的期待。

- [x] **Step 2: 修改浏览器合约**

断言左树不存在“全部”节点、右树只显示当前集采平台来源分类、映射线数量与当前已映射来源数量一致、页面无商品图片，并保留保存、解除、查询、切换和下钻流程。

- [x] **Step 3: 运行 RED**

```bash
node --test --test-name-pattern='category mapping' tests/prototype.test.js
env NODE_PATH='/Users/xukai/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules' '/Users/xukai/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node' tests/visual-check.js
```

预期：因缺少 `data-mapping-compare` 和树形关系层失败。

- [x] **Step 4: 同步 PRD**

将 8.2 的“查询表单 + 映射表格”改为“平台页签 + 查询表单 + 左右树形对照区”，写清对象方向、数量标签和无商品图片边界。

### Task 2: 实现左右树与关系线

**Files:**
- Modify: `admin.html`

**Interfaces:**
- Consumes: `categoryData`、`filteredMappingRows()`、`mappingSupplier()`、`platformCategoryPath()`。
- Produces: `renderMappingPlatformTree()`、`renderMappingSourceTree(records)`、`drawMappingRelations()`、`setMappingRelationHighlight(sourceCategoryId)`。

- [x] **Step 1: 增加独立树状态**

在 `mappingViewState` 中维护平台树和各集采平台来源树的展开集合，避免影响 `productViewState`。

- [x] **Step 2: 渲染平台分类树**

复用 `.product-tree-row` 和 `.product-category-node` 结构，删除“全部”节点，为平台二级分类输出 `data-mapping-platform-node`。

- [x] **Step 3: 渲染来源分类树**

按 `sourcePath` 第一段分组，来源一级分类只负责展开；来源二级节点输出映射状态、来源状态、产品数量和既有单条操作。

- [x] **Step 4: 绘制关系层**

渲染完成后读取可见来源和目标节点位置，从右向左绘制带箭头的 SVG 曲线，在中点放置 `N 个产品` 标签；只为当前查询结果中的已映射来源绘制。

- [x] **Step 5: 增加视觉样式**

实现三列对照、树面板、节点状态、关系线、数量标签、Hover 降噪与 1024px 布局，不增加商品图片。

- [x] **Step 6: 运行 GREEN**

执行定向静态和浏览器测试，修复到通过。

### Task 3: 恢复交互并完成回归

**Files:**
- Modify: `admin.html`
- Modify: `tests/visual-check.js`

**Interfaces:**
- Consumes: Task 2 产出的树节点与关系函数。
- Produces: 平台树/来源树展开、Hover 强化、页面尺寸变化重绘。

- [x] **Step 1: 绑定树展开与关系强化**

平台树、来源树展开后重新渲染；来源节点 hover/focus 时调用 `setMappingRelationHighlight()`。

- [x] **Step 2: 保持既有映射流程**

验证设置映射后新增关系线，解除后移除关系线，查询和重置保留当前平台，数量下钻仍返回分类映射页。

- [x] **Step 3: 完成视觉与响应式检查**

在 1440px 截图检查树和连线，在 1024px 检查无页面级横向溢出、节点和数量标签不重叠。

- [x] **Step 4: 全量验证**

```bash
node --test tests/prototype.test.js
env NODE_PATH='/Users/xukai/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules' '/Users/xukai/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node' tests/visual-check.js
git diff --check
```

预期：19 项静态测试和完整浏览器流程通过；不提交。
