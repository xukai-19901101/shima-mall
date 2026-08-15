# 公开 API 文档页面 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在拾马商城系统管理中增加 API 文档入口，并提供长期有效、无需登录、可搜索和适配移动端的独立公开接口文档页面。

**Architecture:** 后台继续使用现有 `admin.html` 单页渲染模式，新增 `system-api-docs` 菜单与只读信息页；外部文档创建独立 `api-docs.html`，不复用后台壳层和权限状态。公开页以静态 HTML 保存标准文档，通过原生 JavaScript 实现目录、搜索、代码复制和移动端抽屉。

**Tech Stack:** 纯 HTML、CSS、原生 JavaScript、Node.js `node:test`、Playwright。

## Global Constraints

- 公开链接长期有效，无需密码、登录、客户鉴权、有效期或停用配置。
- 所有 API 客户查看同一套标准文档，不生成客户专属链接或文档副本。
- 后台只提供当前版本、公开地址、目录概览、预览和复制公开链接，不提供文档编辑器或分享记录。
- 外部页面不得复用后台导航，不得展示客户信息或任何真实 AppKey、Secret、Token。
- 外部页面必须包含已确认的十个固定章节。
- UI 原型中的接口路径和示例只表达文档结构，不声称生产接口已发布。
- 文档正文在 JavaScript 不可用时仍可阅读。
- 现有后台统一规则继续生效：无重复大标题，保留左上角灰色提示词。
- 当前仓库无提交历史且未授权 Git 提交，不执行提交或推送。

---

### Task 1: 建立后台入口与公开页行为契约

**Files:**
- Modify: `tests/prototype.test.js`
- Modify: `tests/visual-check.js`

**Interfaces:**
- Consumes: 现有 `admin.html` 导航、页面渲染和 Playwright 回归流程。
- Produces: `data-view="system-api-docs"`、`data-api-doc-preview`、`data-api-doc-copy`、`data-doc-search`、`data-doc-toc`、`data-doc-section`、`data-code-copy`、`data-doc-menu` 行为契约。

- [x] **Step 1: 增加后台静态结构测试**

在 `tests/prototype.test.js` 增加：

```js
test('system management exposes the public API documentation entry', () => {
  const html = read('admin.html');
  for (const marker of [
    'data-view="system-api-docs"',
    'data-api-doc-preview',
    'data-api-doc-copy'
  ]) assert.match(html, new RegExp(marker));
  assert.match(html, /API文档/);
  assert.match(html, /公开访问/);
});
```

- [x] **Step 2: 增加公开文档静态结构测试**

```js
test('public API documentation exposes the approved integration chapters', () => {
  const html = read('api-docs.html');
  for (const marker of [
    'data-doc-search', 'data-doc-toc', 'data-doc-section',
    'data-code-copy', 'data-doc-menu'
  ]) assert.match(html, new RegExp(marker));
  for (const title of [
    '接入说明与鉴权', '商品分类与商品/SKU查询',
    '收货地址、实时库存与运费查询', '创建订单',
    '订单查询与状态说明', '物流查询',
    '取消订单与异常处理', '账户余额查询',
    '回调通知与幂等规则', '公共错误码与联调示例'
  ]) assert.match(html, new RegExp(title.replace('/', '\\/')));
  assert.doesNotMatch(html, /平台运营后台/);
});
```

- [x] **Step 3: 增加浏览器回归场景**

在 `tests/visual-check.js` 后台系统管理流程后加入：

```js
await admin.click('[data-view="system-api-docs"]');
const apiDocAdminText = await admin.locator('#content').innerText();
for (const required of ['公开地址', '当前版本', '公开访问', '十个章节']) {
  if (!apiDocAdminText.includes(required)) throw new Error(`API doc admin page is missing ${required}`);
}
await admin.click('[data-api-doc-copy]');
if (!(await admin.locator('#toast').innerText()).includes('公开链接已复制')) {
  throw new Error('Public API doc link was not copied');
}
```

创建独立页面后验证：十个章节、搜索、目录定位、代码复制和移动端目录抽屉。

- [x] **Step 4: 运行测试确认红灯**

Run:

```bash
node --test tests/prototype.test.js
NODE_PATH='/Users/xukai/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules' \
'/Users/xukai/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node' tests/visual-check.js
```

Expected: 静态测试因 `api-docs.html` 不存在及后台缺少新标记失败；浏览器测试因缺少系统管理 API文档入口失败。

### Task 2: 同步 PRD 并实现后台 API 文档入口

**Files:**
- Modify: `docs/拾马商城后台一期PRD.md`
- Modify: `admin.html`

**Interfaces:**
- Produces: `systemApiDocsPage()`、后台菜单编码 `system-api-docs`、`copyPublicApiDocUrl()`。
- Consumes: 现有 `adminMenuTree`、`pageRenderers`、`toast()`、角色菜单权限树。

- [x] **Step 1: 更新 PRD 菜单和系统管理职责**

将系统管理目录更新为：

```text
系统管理
├── 用户管理
├── 角色权限
└── API文档
```

新增 `9.3 API文档`，写明固定公开链接、无需鉴权、统一标准内容、后台只读管理入口及外部页面边界。验收标准补充菜单、公开访问和敏感信息边界。

- [x] **Step 2: 增加后台菜单与角色权限节点**

在侧边导航系统管理下增加：

```html
<button class="nav-item" data-view="system-api-docs">API文档</button>
```

在 `adminMenuTree` 系统管理 children 中增加：

```js
{ code: 'system-api-docs', name: 'API文档' }
```

角色权限树通过现有 `renderPermissionTree()` 自动获得该菜单，不新建按钮权限。

- [x] **Step 3: 实现后台只读信息页**

新增：

```js
function systemApiDocsPage() {
  const sections = [
    '接入说明与鉴权', '商品分类与商品/SKU查询',
    '收货地址、实时库存与运费查询', '创建订单',
    '订单查询与状态说明', '物流查询',
    '取消订单与异常处理', '账户余额查询',
    '回调通知与幂等规则', '公共错误码与联调示例'
  ];
  return `<div class="page-head"><p class="page-desc">API客户统一访问同一套公开接口文档；链接长期有效，请勿在文档中填写客户密钥</p><div class="page-actions"><button class="btn" data-api-doc-preview>预览公开文档</button><button class="btn primary" data-api-doc-copy>复制公开链接</button></div></div>
    <section class="config-card" data-api-doc-admin><div class="detail-grid"><div class="detail-item"><span>公开地址</span><strong data-api-doc-url>api-docs.html</strong></div><div class="detail-item"><span>当前版本</span><strong>v1.0</strong></div><div class="detail-item"><span>最近更新时间</span><strong>2026-08-14</strong></div><div class="detail-item"><span>文档状态</span><strong>公开访问</strong></div></div><div class="api-doc-section-grid">${sections.map((title,index) => `<article><span>${String(index + 1).padStart(2,'0')}</span><strong>${title}</strong></article>`).join('')}</div></section>`;
}
```

页面显示固定字段：公开地址 `api-docs.html`、当前版本 `v1.0`、最近更新时间 `2026-08-14`、状态“公开访问”，并以卡片展示十个章节。

- [x] **Step 4: 绑定预览和复制交互**

新增：

```js
function publicApiDocUrl() {
  return new URL('api-docs.html', window.location.href).href;
}

async function copyPublicApiDocUrl() {
  const url = publicApiDocUrl();
  try {
    await navigator.clipboard.writeText(url);
    toast('公开链接已复制');
  } catch (error) {
    toast('复制失败，请手工复制公开地址');
  }
}
```

`预览公开文档` 使用 `window.open(publicApiDocUrl(), '_blank', 'noopener')`；复制按钮调用 `copyPublicApiDocUrl()`。

- [x] **Step 5: 运行后台相关测试**

Run: `node --test tests/prototype.test.js`

Expected: 后台入口测试通过；公开文档测试仍因文件未创建失败。

### Task 3: 创建独立公开文档页面与十个固定章节

**Files:**
- Create: `api-docs.html`

**Interfaces:**
- Produces: 静态文档结构、章节锚点、统一接口卡片、参数表、代码示例。
- Consumes: 拾马商城现有视觉变量 `--brand:#315CF5`、`--ink:#14233B`、`--success:#14A889`。

- [x] **Step 1: 建立独立页面壳层**

页面只包含公开文档组件：

```html
<header class="doc-header">
  <button class="menu-button" data-doc-menu aria-label="打开目录">目录</button>
  <a class="doc-brand" href="#quick-start">拾马商城开放接口文档</a>
  <span class="version">v1.0</span>
  <input type="search" data-doc-search placeholder="搜索接口、字段或错误码">
</header>
<div class="doc-layout">
  <aside class="doc-sidebar" data-doc-toc>
    <a data-doc-link="quick-start" href="#quick-start">接入说明与鉴权</a>
    <a data-doc-link="catalog" href="#catalog">商品分类与商品/SKU查询</a>
  </aside>
  <main class="doc-main" id="docMain">
    <p class="prototype-note">原型示例，正式联调以已确认接口合同为准。</p>
    <div class="empty-state" data-doc-empty hidden>未找到匹配接口</div>
  </main>
</div>
```

禁止复制后台 `.sidebar`、`.topbar`、账号头像和后台面包屑。

- [x] **Step 2: 建立统一接口条目结构**

每个接口使用：

```html
<article class="endpoint-card" data-doc-entry data-search-text="获取访问令牌 auth token 鉴权">
  <div class="endpoint-heading">
    <span class="method post">POST</span>
    <code>/openapi/v1/auth/token</code>
  </div>
  <p>客户服务端在调用业务接口前换取短期访问令牌。</p>
  <div class="parameter-table">
    <table><thead><tr><th>参数</th><th>类型</th><th>必填</th><th>说明</th></tr></thead>
    <tbody><tr><td>app_key</td><td>String</td><td>是</td><td>平台分配的应用标识</td></tr></tbody></table>
  </div>
  <pre><code>{
  "app_key": "YOUR_APP_KEY",
  "signature": "YOUR_SIGNATURE",
  "request_id": "YOUR_REQUEST_ID"
}</code><button data-code-copy>复制</button></pre>
</article>
```

示例凭证统一使用 `YOUR_APP_KEY`、`YOUR_SIGNATURE`、`YOUR_REQUEST_ID`，不得出现可用密钥。

- [x] **Step 3: 填充十个固定章节**

按规格逐章创建 `section[data-doc-section]`，每章至少包含一个代表性接口条目。使用统一示例路径前缀 `/openapi/v1`，并在页面顶部明确标记“原型示例，正式联调以已确认接口合同为准”。

代表性条目：

```text
POST /auth/token
GET  /categories
GET  /products/{sku_id}
POST /inventory/query
POST /freight/query
POST /orders
GET  /orders/{client_order_no}
GET  /orders/{client_order_no}/logistics
POST /orders/{client_order_no}/cancel
GET  /account/balance
POST {client_callback_url}
GET  /errors
```

- [x] **Step 4: 保证无 JavaScript 时正文可读**

所有章节初始直接存在于 HTML，不通过 JavaScript 动态生成；JavaScript 只增强搜索、目录高亮、复制和移动端抽屉。

- [x] **Step 5: 运行静态测试**

Run: `node --test tests/prototype.test.js`

Expected: 后台和公开文档静态结构测试全部通过。

### Task 4: 实现搜索、目录、复制与响应式交互

**Files:**
- Modify: `api-docs.html`
- Modify: `tests/visual-check.js`

**Interfaces:**
- Produces: `filterDocumentation(keyword)`、`setActiveSection(sectionId)`、`copyCode(button)`、`toggleDocumentMenu(force)`。
- Consumes: `data-doc-entry`、`data-search-text`、`data-doc-link`、`data-code-copy`、`data-doc-menu`。

- [x] **Step 1: 实现全文搜索**

```js
function filterDocumentation(keyword) {
  const normalized = keyword.trim().toLowerCase();
  let visibleCount = 0;
  document.querySelectorAll('[data-doc-entry]').forEach(entry => {
    const visible = !normalized || entry.dataset.searchText.toLowerCase().includes(normalized);
    entry.hidden = !visible;
    if (visible) visibleCount += 1;
  });
  document.querySelector('[data-doc-empty]').hidden = visibleCount > 0;
}
```

搜索框清空后恢复所有条目；无结果时展示“未找到匹配接口”。

- [x] **Step 2: 实现目录定位与当前项高亮**

目录链接使用章节 ID 定位；点击后调用 `scrollIntoView({ behavior:'smooth', block:'start' })`。使用 `IntersectionObserver` 更新 `[data-doc-link].active`；浏览器不支持时仍保留普通锚点跳转。

- [x] **Step 3: 实现代码复制**

`data-code-copy` 读取同一代码块文本并调用剪贴板；成功后按钮显示“已复制”，1.5 秒后恢复。失败时按钮显示“请手工复制”。

- [x] **Step 4: 实现移动端目录抽屉**

在 `max-width: 860px` 下隐藏固定侧栏，`data-doc-menu` 打开覆盖式目录抽屉；点击遮罩、关闭按钮或目录项后关闭。参数表设置 `overflow-x:auto`，代码块保持横向滚动。

- [x] **Step 5: 完善浏览器测试**

验证：

```js
await docs.locator('[data-doc-search]').fill('库存');
if (!(await docs.locator('body').innerText()).includes('实时库存')) throw new Error('Doc search failed');
await docs.locator('[data-doc-search]').fill('不存在的接口');
if (!(await docs.locator('[data-doc-empty]').isVisible())) throw new Error('Doc empty state failed');
await docs.locator('[data-doc-search]').fill('');
await docs.click('[data-doc-link="orders-create"]');
await docs.click('[data-code-copy]');
```

移动端使用 `page.setViewportSize({ width:390, height:844 })` 后验证菜单打开、章节跳转和横向表格可读。

- [x] **Step 6: 运行完整浏览器回归**

Run:

```bash
NODE_PATH='/Users/xukai/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules' \
'/Users/xukai/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node' tests/visual-check.js
```

Expected: 后台既有流程、小程序兑换流程和公开 API 文档流程全部通过。

### Task 5: 截图、回归与实施状态收口

**Files:**
- Modify: `docs/superpowers/specs/2026-08-14-public-api-documentation-design.md`
- Modify: `docs/superpowers/plans/2026-08-14-public-api-documentation-ui.md`
- Generate: `artifacts/admin-api-docs.png`
- Generate: `artifacts/public-api-docs.png`
- Generate: `artifacts/public-api-docs-mobile.png`

**Interfaces:**
- Consumes: 完成后的后台入口和外部公开文档页。
- Produces: 自动化验证证据、页面截图、已实施文档状态。

- [x] **Step 1: 运行最终静态测试**

Run: `node --test tests/prototype.test.js`

Expected: 全部测试通过。

- [x] **Step 2: 运行最终浏览器回归**

Run:

```bash
NODE_PATH='/Users/xukai/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules' \
'/Users/xukai/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node' tests/visual-check.js
```

Expected: 输出 `visual-check: admin navigation/pagination and miniapp redemption flow passed`，并包含公开文档断言通过。

- [x] **Step 3: 人工检查截图**

检查：后台无重复大标题；外部页面无后台壳层；十个章节目录清楚；代码示例和参数表可读；移动端目录抽屉不遮挡关闭入口。

- [x] **Step 4: 更新实施状态**

将设计状态更新为“方案与静态原型 UI 已实施并通过回归验证”，并勾选本计划所有步骤。

- [x] **Step 5: 最终一致性扫描**

```bash
rg -n 'data-view="system-api-docs"|data-api-doc-preview|data-api-doc-copy' admin.html
rg -n 'data-doc-search|data-doc-toc|data-doc-section|data-code-copy|data-doc-menu' api-docs.html
rg -n '分享密码|有效期|分享记录|客户专属' admin.html api-docs.html
rg -n '^- \[ \]' docs/superpowers/plans/2026-08-14-public-api-documentation-ui.md
```

Expected: 新入口与公开页标记存在；页面不出现已排除的分享治理功能；计划无未完成步骤。
