# 分类管理统一新增入口 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将分类管理的一级、二级分类创建收拢到右上角“新增分类”入口，并移除一级分类行内“新增二级分类”。

**Architecture:** 复用现有分类弹窗和 `categoryData`，将只读层级输入改为新增时可选、编辑时只读的层级选择器。根据层级联动所属一级分类字段，保存仍进入现有一级或二级分类数据结构。

**Tech Stack:** 纯 HTML、CSS、原生 JavaScript、Node.js `node:test`、Playwright。

## Global Constraints

- 分类保持两级结构，不允许创建三级分类。
- 页面右上角只保留“新增分类”入口。
- 一级分类行不再展示“新增二级分类”。
- 新增时默认一级分类；选择二级分类后所属一级分类必填。
- 编辑已有分类时分类层级不可修改。
- 当前仓库没有提交历史且未取得 Git 提交授权，不执行提交或推送。

---

### Task 1: 建立统一新增入口交互契约

**Files:**
- Modify: `tests/visual-check.js`

**Interfaces:**
- Consumes: 分类页 `data-category-modal` 和现有分类编辑行为。
- Produces: `data-category-add`、`name="categoryLevel"`、`data-category-parent-field` 的浏览器行为契约。

- [x] **Step 1: 写入失败测试**

在分类页面测试中断言：右上角入口文案为“新增分类”；页面不存在 `data-category-add-child`；新增弹窗默认一级且隐藏父级；切换二级后显示父级且未选父级不能保存；编辑已有分类时层级不可修改。

```js
if (await admin.locator('[data-category-add-child]').count()) {
  throw new Error('Category rows still expose a level-two create shortcut');
}
if ((await admin.locator('[data-category-add]').innerText()).trim() !== '新增分类') {
  throw new Error('Category page does not expose the unified create entry');
}
await admin.click('[data-category-add]');
const levelSelect = admin.locator('[data-category-modal] [name="categoryLevel"]');
if (await levelSelect.inputValue() !== '1' || await levelSelect.isDisabled()) {
  throw new Error('New category form does not default to editable level one');
}
await levelSelect.selectOption('2');
if (await admin.locator('[data-category-parent-field]').isHidden()) {
  throw new Error('Level-two create form does not show the parent category');
}
await admin.click('[data-category-save]');
if (!(await admin.locator('#toast').innerText()).includes('请选择所属一级分类')) {
  throw new Error('Level-two category can be saved without a parent');
}
```

- [x] **Step 2: 运行浏览器测试确认红灯**

Run:

```bash
NODE_PATH='/Users/xukai/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules' \
'/Users/xukai/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node' tests/visual-check.js
```

Expected: FAIL，首先命中一级分类行仍存在 `data-category-add-child`。

### Task 2: 实现统一新增表单

**Files:**
- Modify: `admin.html`

**Interfaces:**
- Consumes: `openCategoryEditor()`、`saveCategoryEditor()`、`findCategory()`。
- Produces: `syncCategoryLevelFields()` 和统一 `data-category-add` 入口。

- [x] **Step 1: 移除行内新增并替换顶部入口**

- 从一级分类行删除 `data-category-add-child` 按钮。
- 将顶部按钮改为 `<button ... data-category-add>新增分类</button>`。
- 删除 `render()` 中对 `data-category-add-child` 的事件绑定。

- [x] **Step 2: 将层级字段改为新增可选、编辑只读**

将分类层级字段替换为：

```html
<select class="field" name="categoryLevel">
  <option value="1">一级分类</option>
  <option value="2">二级分类</option>
</select>
```

所属一级分类容器增加 `data-category-parent-field`。

- [x] **Step 3: 实现层级与父级联动**

新增 `syncCategoryLevelFields()`：读取层级选择器；一级时隐藏并禁用父级字段，同时清空父级值；二级时显示并启用父级字段；新增时同步弹窗标题。

`openCategoryEditor(categoryId='')` 在新增时启用层级选择器并默认一级，在编辑时设置现有层级并禁用选择器。

- [x] **Step 4: 增加二级父级必填校验**

`saveCategoryEditor()` 从层级选择器读取层级。当层级为 2 且父级为空时，停止保存并提示“请选择所属一级分类”。

- [x] **Step 5: 绑定统一入口和层级切换事件**

在 `render()` 中将 `data-category-add-root` 替换为 `data-category-add`，并为新增弹窗的层级选择器绑定 `change` 事件调用 `syncCategoryLevelFields()`。

- [x] **Step 6: 运行浏览器测试确认转绿**

Run:

```bash
NODE_PATH='/Users/xukai/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules' \
'/Users/xukai/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node' tests/visual-check.js
```

Expected: PASS，统一新增入口、父级必填和原有分类编辑均通过。

### Task 3: 文档和全量回归

**Files:**
- Modify: `docs/拾马商城后台一期PRD.md`
- Modify: `docs/superpowers/specs/2026-08-14-query-list-page-standard-design.md`
- Modify: `docs/superpowers/specs/2026-08-14-category-tree-table-design.md`
- Modify: `docs/superpowers/plans/2026-08-14-category-unified-create-entry.md`

**Interfaces:**
- Consumes: 最终分类新增交互和商品操作列。
- Produces: 无冲突的当前需求文档与验证状态。

- [x] **Step 1: 更新 PRD**

分类管理写明“右上角统一新增分类，一级行无新增入口”；商品管理将页面级操作和行级操作分开，行级操作明确为编辑、查看 SKU、上下架。

- [x] **Step 2: 清理规范冲突并更新状态**

移除查询列表规范中“行级新增二级分类保留”的旧描述，将分类树形表格设计状态改为“方案已确认，原型已实施”。

- [x] **Step 3: 运行完整测试**

Run:

```bash
node --test tests/prototype.test.js
NODE_PATH='/Users/xukai/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules' \
'/Users/xukai/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node' tests/visual-check.js
```

Expected: 静态测试零失败，浏览器交互测试通过。

- [x] **Step 4: 核对旧入口已清除**

Run:

```bash
! rg -n 'data-category-add-child|data-category-add-root|一级分类行支持新增二级分类|行级新增二级分类' admin.html docs/拾马商城后台一期PRD.md docs/superpowers/specs/2026-08-14-query-list-page-standard-design.md
```

Expected: exit code 0。
- [x] **Step 5: 勾选计划完成项**

将本计划全部步骤改为 `[x]`，并确认不存在未完成项。
