const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');

function read(file) {
  return fs.readFileSync(path.join(root, file), 'utf8');
}

test('admin prototype exposes the complete minimum-loop navigation', () => {
  const html = read('admin.html');
  for (const label of ['经营看板', '小程序商城客户', 'API供货客户', '商品库', '供货平台管理']) {
    assert.match(html, new RegExp(label));
  }
  for (const label of ['经营总览', '渠道经营分析', '小程序客户', '商城订单', '积分对账', 'API客户', 'API订单', '资金对账', '分类管理', '商品管理', '供货平台', '分类映射']) {
    assert.match(html, new RegExp(label));
  }
  assert.doesNotMatch(html, />积分账户</);
  assert.doesNotMatch(html, /data-view="sourcing-products"/);
  for (const oldModule of ['企业管理', '商品与供货', '订单履约', '账户结算']) {
    assert.doesNotMatch(html, new RegExp(`>${oldModule}<`));
  }
  assert.match(html, /class="stat-grid"/);
  assert.match(html, /class="data-table"/);
  assert.match(html, /data-page="2"/);
  assert.match(html, /data-view="category"/);
  assert.doesNotMatch(html, /小程序企业/);
});

test('admin prototype exposes system user and role management entries', () => {
  const html = read('admin.html');
  for (const label of ['系统管理', '用户管理', '角色权限', '超级管理员', '菜单权限']) {
    assert.match(html, new RegExp(label));
  }
  for (const marker of ['data-view="system-users"', 'data-view="system-roles"', 'data-user-modal', 'data-role-modal', 'data-permission-tree']) {
    assert.match(html, new RegExp(marker));
  }
});

test('system management exposes the public API documentation entry', () => {
  const html = read('admin.html');
  for (const marker of [
    'data-view="system-api-docs"',
    'data-api-doc-preview',
    'data-api-doc-copy'
  ]) {
    assert.match(html, new RegExp(marker));
  }
  assert.match(html, /API文档/);
  assert.match(html, /公开访问/);
});

test('public API documentation exposes the approved integration chapters', () => {
  const documentPath = path.join(root, 'api-docs.html');
  assert.equal(fs.existsSync(documentPath), true, 'api-docs.html should exist');
  const html = fs.readFileSync(documentPath, 'utf8');
  for (const marker of [
    'data-doc-search',
    'data-doc-toc',
    'data-doc-section',
    'data-code-copy',
    'data-doc-menu'
  ]) {
    assert.match(html, new RegExp(marker));
  }
  for (const title of [
    '接入说明与鉴权',
    '商品分类与商品/SKU查询',
    '收货地址、实时库存与运费查询',
    '创建订单',
    '订单查询与状态说明',
    '物流查询',
    '取消订单与异常处理',
    '账户余额查询',
    '回调通知与幂等规则',
    '公共错误码与联调示例'
  ]) {
    assert.match(html, new RegExp(title.replace('/', '\\/')));
  }
  assert.doesNotMatch(html, /平台运营后台/);
});

test('channel analysis is merged behind one navigation entry', () => {
  const html = read('admin.html');
  assert.match(html, /data-view="channel-analysis"/);
  assert.doesNotMatch(html, /data-view="mini-analysis"/);
  assert.doesNotMatch(html, /data-view="api-analysis"/);
  assert.match(html, /渠道经营分析/);
  for (const label of ['订单与资金结算闭环', '商品销量排行', '企业贡献排行']) {
    assert.match(html, new RegExp(label));
  }
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
  for (const label of ['小程序商城客户', 'API 供货客户', '消费积分', '冻结积分', '采购成功率', '余额差异']) {
    assert.match(html, new RegExp(label));
  }
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
});

test('approved menus are persisted in the phase-one PRD', () => {
  const prd = read('docs/拾马商城后台一期PRD.md');
  for (const label of ['渠道经营分析', '小程序商城客户', '小程序客户', 'API 供货客户', '商品库', '供货平台管理', '分类管理', '商品管理', '供货平台', '分类映射']) {
    assert.match(prd, new RegExp(label));
  }
  assert.doesNotMatch(prd, /### 4\.2 小程序商城分析/);
  assert.doesNotMatch(prd, /### 4\.3 API供货分析/);
  assert.doesNotMatch(prd, /小程序企业/);
  for (const label of ['订单与资金结算闭环', '商品销量排行', '企业贡献排行']) {
    assert.match(prd, new RegExp(label));
  }
});

test('admin prototype reflects the approved category and pricing boundaries', () => {
  const html = read('admin.html');
  assert.match(html, /平台两级分类/);
  assert.doesNotMatch(html, /三级分类/);
  assert.match(html, /成本价\/采购价/);
  assert.match(html, /平台兜底加价/);
  assert.match(html, /企业分类加价/);
  assert.match(html, /企业默认兜底比例/);
  assert.match(html, /企业默认兜底/);
});

test('category management uses an editable two-level tree table', () => {
  const html = read('admin.html');
  for (const label of ['分类名称', '分类编码', '分类层级', '集采商品数', '自营商品数', '排序', '更新时间']) {
    assert.match(html, new RegExp(label));
  }
  assert.match(html, /class="category-tree-table/);
  assert.match(html, /data-category-toggle/);
  assert.match(html, /data-category-edit/);
  assert.match(html, /data-category-child/);
  assert.match(html, /data-category-modal/);
});

test('product management uses the approved category tree master-detail layout', () => {
  const html = read('admin.html');
  for (const marker of [
    'data-product-layout',
    'data-product-category="all"',
    'data-product-current-category',
    'data-product-tree-toggle',
    'data-product-source'
  ]) {
    assert.match(html, new RegExp(marker));
  }
  assert.match(html, /当前分类/);

  const prd = read('docs/拾马商城后台一期PRD.md');
  for (const rule of [
    '左侧分类树',
    '一级分类及其全部二级分类',
    '二级分类直属商品',
    '保留当前分类'
  ]) {
    assert.match(prd, new RegExp(rule));
  }
});

test('supplier source goods are reached from the supplier platform instead of a standalone menu', () => {
  const html = read('admin.html');
  assert.doesNotMatch(html, /data-view="sourcing-products"/);
  for (const marker of ['data-supplier-sources', 'data-supplier-source-page', 'data-supplier-source-back']) {
    assert.match(html, new RegExp(marker));
  }
});

test('category mapping exposes the approved supplier-scoped tree comparison workflow', () => {
  const html = read('admin.html');
  for (const marker of [
    'data-mapping-supplier-tab',
    'data-mapping-compare',
    'data-mapping-platform-tree',
    'data-mapping-source-tree',
    'data-mapping-relations',
    'data-mapping-platform-node',
    'data-mapping-source-node',
    'data-mapping-relation',
    'data-mapping-product-count',
    'data-mapping-row',
    'data-mapping-edit',
    'data-mapping-modal',
    'data-mapping-import',
    'data-mapping-product-link'
  ]) {
    assert.match(html, new RegExp(marker));
  }
  for (const label of ['平台商品分类', '来源分类', '个产品']) {
    assert.match(html, new RegExp(label));
  }
});

test('reconciliation KPI board exposes the approved monthly overview contract', () => {
  const html = read('admin.html');
  for (const marker of [
    'data-reconciliation-kpis',
    'data-reconciliation-kpi',
    'data-reconciliation-kpi-value',
    'data-reconciliation-kpi-note'
  ]) {
    assert.match(html, new RegExp(marker));
  }
  for (const label of ['本月采购金额', '本月退款与调整', '当前接口余额', '当前账面余额', '本月累计差异', '待核对订单']) {
    assert.match(html, new RegExp(label));
  }
});

test('points reconciliation mirrors the approved monthly KPI overview', () => {
  const html = read('admin.html');
  for (const marker of [
    'data-points-reconciliation-kpis',
    'data-reconciliation-kpi',
    'data-reconciliation-kpi-value',
    'data-reconciliation-kpi-note'
  ]) {
    assert.match(html, new RegExp(marker));
  }
  for (const label of ['本月积分充值', '本月积分消费', '当前可用积分', '当前冻结积分', '本月累计差异', '待核对订单']) {
    assert.match(html, new RegExp(label));
  }
});

test('order lists expose aggregate status quick tabs', () => {
  const html = read('admin.html');
  for (const marker of ['data-order-status-tabs', 'data-order-status-tab', 'data-order-count', 'data-order-row']) {
    assert.match(html, new RegExp(marker));
  }
  for (const label of ['全部', '待处理', '待发货', '已发货', '已完成', '售后/异常']) {
    assert.match(html, new RegExp(label));
  }
});

test('order lists expose state-aware row actions', () => {
  const html = read('admin.html');
  for (const marker of [
    'data-order-actions',
    'data-order-action',
    'data-order-action-modal',
    'data-order-action-submit',
    'data-order-action-error'
  ]) {
    assert.match(html, new RegExp(marker));
  }
  for (const label of ['查看详情', '发货', '退款', '关闭订单']) {
    assert.match(html, new RegExp(label));
  }
  assert.doesNotMatch(html, /data-order-action-permission/);
});

test('query list pages use the unified toolbar and no table summary header', () => {
  const html = read('admin.html');
  assert.match(html, /data-query-form/);
  assert.match(html, /data-query-submit/);
  assert.match(html, /data-query-reset/);
  assert.doesNotMatch(html, /class="table-summary"/);
  for (const label of ['更多筛选', '>筛选<', '展开全部', '收起全部']) {
    assert.doesNotMatch(html, new RegExp(label));
  }
});

test('admin uses the top breadcrumb as the only page heading', () => {
  const html = read('admin.html');
  assert.match(html, /id="crumbCurrent"/);
  assert.doesNotMatch(html, /class="page-title"/);
});

test('admin keeps compact gray page hints but removes large prompt blocks', () => {
  const html = read('admin.html');
  assert.doesNotMatch(html, /class="rule-strip"/);
  assert.doesNotMatch(html, /class="rule-cell"/);
  assert.doesNotMatch(html, /class="rule-note"/);
  assert.match(html, /class="page-desc"/);
});

test('mini program exposes tabs and the core redemption flow', () => {
  const html = read('miniapp.html');
  for (const label of ['商城', '分类', '订单', '企业']) {
    assert.match(html, new RegExp(`>${label}<`));
  }
  for (const view of ['home', 'category', 'orders', 'profile', 'product', 'checkout', 'success']) {
    assert.match(html, new RegExp(`data-screen="${view}"`));
  }
  assert.match(html, /立即兑换/);
  assert.match(html, /确认兑换/);
});

test('both prototypes use responsive viewports and the same visual tokens', () => {
  const admin = read('admin.html');
  const miniapp = read('miniapp.html');
  for (const html of [admin, miniapp]) {
    assert.match(html, /name="viewport"/);
    assert.match(html, /--brand:\s*#315CF5/);
    assert.match(html, /--ink:\s*#14233B/);
    assert.match(html, /--success:\s*#14A889/);
    assert.doesNotMatch(html, /<script[^>]+src=/);
    assert.doesNotMatch(html, /<link[^>]+stylesheet/);
  }
});

test('local review page provides a non-Figma delivery entry', () => {
  const html = read('review.html');
  assert.match(html, /业务闭环评审/);
  assert.match(html, /admin\.html/);
  assert.match(html, /miniapp\.html/);
  assert.match(html, /P0/);
});

test('all prototype delivery entries use the 拾马商城 product name', () => {
  for (const file of ['admin.html', 'miniapp.html', 'review.html']) {
    const html = read(file);
    assert.match(html, /拾马商城/);
    assert.doesNotMatch(html, /衡兑/);
  }
});
