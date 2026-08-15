# 系统管理与菜单权限 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在拾马商城后台原型中增加系统管理模块、用户管理和角色权限页面，并将单用户单角色、菜单权限及超级管理员边界同步到一期 PRD。

**Architecture:** 保持现有单文件 `admin.html` 架构，新增系统用户、角色和菜单权限的静态数据与两个专用页面渲染器。用户与角色共用现有查询列表、弹窗和反馈样式；角色菜单权限由一套树形 checkbox 组件维护，原型只演示菜单授权，不引入按钮权限和数据范围权限。

**Tech Stack:** 纯 HTML、CSS、原生 JavaScript、Node.js `node:test`、Playwright。

## Global Constraints

- 系统管理只面向拾马商城平台内部后台账号。
- 一个用户只绑定一个角色。
- 一期只实现菜单权限，不实现按钮权限、数据范围权限、多角色和组织架构。
- 系统内置超级管理员，自动拥有全部菜单且不可停用或减少权限。
- 页面遵循现有统一查询列表规范，内容区保留灰色提示词，不增加重复大标题或大块说明。
- 当前仓库没有提交历史且未授权 Git 提交，不执行提交或推送。

---

### Task 1: 建立系统管理静态与交互契约

**Files:**
- Modify: `tests/prototype.test.js`
- Modify: `tests/visual-check.js`

**Interfaces:**
- Consumes: 现有后台导航、`data-query-form` 查询规范和 `render(view)` 页面路由。
- Produces: `system-users`、`system-roles` 页面路由，以及 `data-user-*`、`data-role-*`、`data-permission-*` 交互契约。

- [x] **Step 1: 添加静态契约测试**

在 `tests/prototype.test.js` 新增：

```js
test('admin prototype exposes system user and role management entries', () => {
  const html = read('admin.html');
  for (const label of ['系统管理', '用户管理', '角色权限', '超级管理员', '菜单权限']) {
    assert.match(html, new RegExp(label));
  }
  for (const marker of ['data-view="system-users"', 'data-view="system-roles"', 'data-user-modal', 'data-role-modal', 'data-permission-tree']) {
    assert.match(html, new RegExp(marker));
  }
});
```

- [x] **Step 2: 添加浏览器行为测试**

在 `tests/visual-check.js` 的系统管理回归区验证：

```js
await admin.click('[data-view="system-users"]');
if (!(await admin.locator('#content').innerText()).includes('平台内部后台账号')) {
  throw new Error('User management scope is unclear');
}
await admin.click('[data-user-add]');
if (!(await admin.locator('[data-user-modal]').isVisible())) throw new Error('User modal did not open');
await admin.click('[data-user-modal-close]');

await admin.click('[data-view="system-roles"]');
await admin.click('[data-role-edit="ROLE-OPS"]');
if (!(await admin.locator('[data-permission-tree]').isVisible())) throw new Error('Permission tree did not open');
const child = admin.locator('[data-permission-child="api-orders"]');
await child.uncheck();
await admin.click('[data-role-save]');
if (!(await admin.locator('#toast').innerText()).includes('角色权限已保存')) {
  throw new Error('Role menu permissions were not saved');
}
```

同时验证：

- 两页查询表单仅包含“查询、重置”。
- 用户列表存在新建、编辑、启停、重置密码入口。
- 角色列表存在新建、编辑、启停入口。
- 超级管理员行不允许停用，菜单权限入口显示“全部菜单”。
- 1024px 桌面宽度无横向溢出。

- [x] **Step 3: 运行测试确认红灯**

Run:

```bash
node --test tests/prototype.test.js
NODE_PATH='/Users/xukai/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules' \
'/Users/xukai/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node' tests/visual-check.js
```

Expected: 静态测试因缺少“系统管理”导航失败；浏览器测试因找不到 `system-users` 路由失败。

### Task 2: 更新一期 PRD 和既有需求边界

**Files:**
- Modify: `docs/拾马商城后台一期PRD.md`
- Modify: `docs/superpowers/specs/2026-08-14-channel-modules-and-catalog-design.md`

**Interfaces:**
- Consumes: `docs/superpowers/specs/2026-08-14-system-management-menu-permissions-design.md`。
- Produces: 无旧结论冲突的当前一期范围和菜单目录。

- [x] **Step 1: 更新一期范围与菜单树**

删除“一期不区分操作角色”，在一期范围加入：

```text
系统管理
├── 用户管理
└── 角色权限
```

并明确：仅平台内部账号、单用户单角色、只做菜单权限。

- [x] **Step 2: 增加用户管理章节**

写入页面查询字段、列表字段、新建/编辑/启停/重置密码、登录账号唯一、停用会话失效和最后一个超级管理员保护规则。

- [x] **Step 3: 增加角色权限章节**

写入角色列表、菜单权限树、父子联动、普通角色至少一个二级菜单、角色停用影响、超级管理员不可修改，以及后端页面访问校验。

- [x] **Step 4: 修订既有设计冲突**

将 `channel-modules-and-catalog-design.md` 中“不增加后台角色和权限体系”改为已被最新系统管理规格覆盖，并指向新规格文件。

### Task 3: 实现系统管理导航与用户管理页面

**Files:**
- Modify: `admin.html`

**Interfaces:**
- Consumes: `queryToolbar(fields)`、`pagination(total)`、`tag(text, tone)`、`toast(message)`、现有 modal 样式。
- Produces: `systemUsers`、`userViewState`、`systemUsersPage()`、`openUserEditor(userId?)`、`saveUserEditor()`。

- [x] **Step 1: 增加系统管理导航**

在侧边导航末尾增加：

```html
<div class="nav-group">
  <button class="nav-parent">系统管理</button>
  <div class="nav-children">
    <button class="nav-item" data-view="system-users">用户管理</button>
    <button class="nav-item" data-view="system-roles">角色权限</button>
  </div>
</div>
```

- [x] **Step 2: 增加用户数据和查询状态**

定义：

```js
const systemUsers = [
  { id:'USR-001', name:'平台管理员', loginName:'admin', mobile:'138****0001', roleId:'ROLE-SUPER', status:'启用', lastLoginAt:'08-14 14:32', createdAt:'08-01 09:00' },
  { id:'USR-002', name:'商城运营', loginName:'mall_ops', mobile:'138****0002', roleId:'ROLE-MALL', status:'启用', lastLoginAt:'08-14 13:58', createdAt:'08-05 10:20' },
  { id:'USR-003', name:'供货运营', loginName:'supply_ops', mobile:'138****0003', roleId:'ROLE-OPS', status:'停用', lastLoginAt:'08-12 17:26', createdAt:'08-06 11:10' }
];
const userViewState = { keyword:'', roleId:'ALL', status:'ALL', editingUserId:'' };
```

- [x] **Step 3: 渲染用户列表与弹窗**

`systemUsersPage()` 输出：

- 灰色提示词和“新建用户”。
- 用户姓名/账号搜索、所属角色、状态、查询、重置。
- 用户姓名、登录账号、手机号、所属角色、状态、最后登录时间、创建时间、操作。
- 新建/编辑弹窗字段为姓名、登录账号、手机号、所属角色、初始/重置密码、状态。

- [x] **Step 4: 绑定用户交互**

- 查询保存 `userViewState` 并刷新列表。
- 重置清空查询条件并回到第 1 页。
- 新建/编辑校验名称、登录账号、启用角色和账号唯一性。
- 停用普通用户后更新状态；超级管理员最后一个启用账号不提供停用入口。
- 重置密码显示明确成功反馈，不展示密码明文。

### Task 4: 实现角色权限页面和菜单树交互

**Files:**
- Modify: `admin.html`

**Interfaces:**
- Consumes: 系统导航的全部一级模块与二级菜单权限编码。
- Produces: `adminMenuTree`、`systemRoles`、`roleViewState`、`systemRolesPage()`、`openRoleEditor(roleId?)`、`syncPermissionParent(moduleCode)`、`saveRoleEditor()`。

- [x] **Step 1: 定义菜单树和角色数据**

`adminMenuTree` 覆盖：经营看板、小程序商城客户、API供货客户、商品库、供货平台管理、系统管理。每个二级菜单使用稳定 `permissionCode`。

`systemRoles` 至少包含：

```js
[
  { id:'ROLE-SUPER', name:'超级管理员', description:'拥有全部后台菜单', status:'启用', isSuperAdmin:true, menuCodes:['*'] },
  { id:'ROLE-MALL', name:'商城运营', description:'负责小程序商城客户与订单', status:'启用', isSuperAdmin:false, menuCodes:['dashboard','mini-analysis','mini-enterprises','mini-orders','points-accounts'] },
  { id:'ROLE-OPS', name:'供货运营', description:'负责API客户与供货平台', status:'启用', isSuperAdmin:false, menuCodes:['dashboard','api-analysis','api-clients','api-orders','api-reconciliation','suppliers','category-mapping','sourcing-products'] }
]
```

- [x] **Step 2: 渲染角色列表与权限弹窗**

角色列表字段：角色名称、角色说明、关联用户数、已授权菜单数、状态、更新时间、操作。

普通角色操作：编辑权限、启用/停用；超级管理员显示“全部菜单”，不展示停用操作。

权限弹窗输出角色名称、说明、状态和 `data-permission-tree` 菜单树；一级 checkbox 使用 `data-permission-parent`，二级 checkbox 使用 `data-permission-child`。

- [x] **Step 3: 实现父子联动与保存**

- 一级勾选/取消时同步全部二级菜单。
- 二级变化时更新一级的 checked/indeterminate。
- 普通角色至少选择一个二级菜单，否则阻止保存。
- 超级管理员菜单树只读。
- 保存后更新角色数据并提示“角色权限已保存”。

- [x] **Step 4: 注册页面和事件**

在 `pageRenderers` 注册：

```js
'system-users': systemUsersPage,
'system-roles': systemRolesPage
```

在 `render(view)` 中绑定用户、角色、菜单 checkbox、弹窗关闭与保存事件，并将两页加入统一查询/重置分支。

### Task 5: 完成视觉回归与规格收口

**Files:**
- Modify: `tests/visual-check.js`
- Modify: `docs/superpowers/specs/2026-08-14-system-management-menu-permissions-design.md`
- Modify: `docs/superpowers/plans/2026-08-14-system-management-menu-permissions.md`
- Generate: `artifacts/admin-system-users.png`
- Generate: `artifacts/admin-system-roles.png`
- Generate: `artifacts/admin-system-role-permissions.png`

**Interfaces:**
- Consumes: 完成后的系统管理页面和交互。
- Produces: 自动化证据、最终截图和已实施文档状态。

- [x] **Step 1: 运行静态测试**

Run: `node --test tests/prototype.test.js`

Expected: 全部静态测试通过。

- [x] **Step 2: 运行浏览器回归**

Run:

```bash
NODE_PATH='/Users/xukai/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules' \
'/Users/xukai/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node' tests/visual-check.js
```

Expected: 系统管理交互、既有后台页面和小程序兑换流程全部通过，生成两个系统管理页面截图。

- [x] **Step 3: 检查实际截图**

检查两个页面在 1440px 下的信息层级、操作栏、弹窗和表格无重叠；在 1024px 下页面无横向溢出。

- [x] **Step 4: 更新规格状态与计划勾选**

将系统管理设计状态改为“方案已确认，原型已实施”，勾选本计划所有已完成步骤。

- [x] **Step 5: 最终一致性检查**

Run:

```bash
rg -n '平台后台一期不区分操作角色|不增加后台角色和权限体系' docs
rg -n 'data-view="system-users"|data-view="system-roles"|data-user-modal|data-role-modal|data-permission-tree' admin.html
```

Expected: 当前需求文档中不存在未说明的旧冲突；五个系统管理标记均存在。
