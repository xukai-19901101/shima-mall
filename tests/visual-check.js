const { chromium } = require('playwright');
const path = require('node:path');
const fs = require('node:fs');

(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
  });
  const root = path.resolve(__dirname, '..');
  const output = path.join(root, 'artifacts');
  fs.mkdirSync(output, { recursive: true });

  const runtimeErrors = [];
  const watch = page => {
    page.on('pageerror', error => runtimeErrors.push(error.message));
    page.on('console', message => {
      if (message.type() === 'error') runtimeErrors.push(message.text());
    });
  };

  const admin = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  watch(admin);
  await admin.goto(`file://${path.join(root, 'admin.html')}`);
  await admin.waitForTimeout(250);
  if (await admin.locator('.page-title').count()) {
    throw new Error('Admin content area still duplicates the current page name as a large heading');
  }
  if (await admin.locator('.rule-strip, .rule-note').count()) {
    throw new Error('Admin pages still render large explanatory prompt blocks');
  }
  if (await admin.locator('.page-desc').count() !== 1) {
    throw new Error('Admin content page does not retain the compact gray helper text');
  }
  await admin.screenshot({ path: path.join(output, 'admin-dashboard.png'), fullPage: true });

  await admin.click('[data-view="channel-analysis"]');
  const miniAnalysisTab = admin.locator('[data-analysis-tab="mini"]');
  const apiAnalysisTab = admin.locator('[data-analysis-tab="api"]');
  if (await miniAnalysisTab.getAttribute('aria-selected') !== 'true') {
    throw new Error('Channel analysis does not default to miniapp customers');
  }
  let analysisText = await admin.locator('#content').innerText();
  for (const section of ['消费积分', '冻结积分', '商品销量排行', '企业贡献排行']) {
    if (!analysisText.includes(section)) throw new Error(`Miniapp analysis is missing ${section}`);
  }
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
  const metricPanelBox = await admin.locator('.analysis-metric-panel').boundingBox();
  const flowPanelBox = await admin.locator('[data-dual-track-flow]').boundingBox();
  if (!metricPanelBox || !flowPanelBox || flowPanelBox.x <= metricPanelBox.x || flowPanelBox.width <= metricPanelBox.width) {
    throw new Error('Wide channel analysis does not use the approved 34/66 layout');
  }
  await admin.screenshot({ path: path.join(output, 'admin-channel-analysis-mini.png'), fullPage: true });
  await admin.selectOption('[data-analysis-period]', { label: '本周' });
  await apiAnalysisTab.click();
  if (await admin.locator('[data-analysis-tab="api"]').getAttribute('aria-selected') !== 'true') {
    throw new Error('API customer tab did not become active');
  }
  if (await admin.locator('[data-analysis-period]').inputValue() !== '本周') {
    throw new Error('Channel tab switch reset the selected period');
  }
  analysisText = await admin.locator('#content').innerText();
  for (const section of ['采购成功率', '余额差异', '商品销量排行', '企业贡献排行']) {
    if (!analysisText.includes(section)) throw new Error(`API analysis is missing ${section}`);
  }
  for (const label of ['API 订单受理', '余额/授信占用', '客户回款', '上游余额校对']) {
    if (!analysisText.includes(label)) throw new Error(`API dual-track flow is missing ${label}`);
  }
  for (const forbidden of ['消费积分', '冻结积分']) {
    if (analysisText.includes(forbidden)) throw new Error(`API analysis leaks miniapp metric ${forbidden}`);
  }
  await admin.screenshot({ path: path.join(output, 'admin-channel-analysis-api.png'), fullPage: true });

  await admin.click('[data-view="api-reconciliation"]');
  const reconciliationBoard = admin.locator('[data-reconciliation-kpis]');
  const reconciliationKpis = reconciliationBoard.locator('[data-reconciliation-kpi]');
  if (await reconciliationKpis.count() !== 6) {
    throw new Error('Reconciliation page does not render six KPI cards');
  }
  const reconciliationText = await reconciliationBoard.innerText();
  for (const label of ['本月采购金额', '本月退款与调整', '当前接口余额', '当前账面余额', '本月累计差异', '待核对订单']) {
    if (!reconciliationText.includes(label)) throw new Error(`Reconciliation KPI board is missing ${label}`);
  }
  if (await reconciliationBoard.locator('[data-reconciliation-kpi-value]').count() !== 6 || await reconciliationBoard.locator('[data-reconciliation-kpi-note]').count() !== 6) {
    throw new Error('Reconciliation KPI cards do not expose one value and one note each');
  }
  const reconciliationLayout = await admin.evaluate(() => {
    const board = document.querySelector('[data-reconciliation-kpis]').getBoundingClientRect();
    const query = document.querySelector('#content [data-query-form]').getBoundingClientRect();
    const table = document.querySelector('#content .table-card').getBoundingClientRect();
    const cardTops = [...document.querySelectorAll('[data-reconciliation-kpi]')].map(element => element.getBoundingClientRect().top);
    const cardContentFlow = [...document.querySelectorAll('[data-reconciliation-kpi]')].map(element => {
      const label = element.querySelector('span').getBoundingClientRect();
      const value = element.querySelector('[data-reconciliation-kpi-value]').getBoundingClientRect();
      const note = element.querySelector('[data-reconciliation-kpi-note]').getBoundingClientRect();
      return { labelBottom: label.bottom, valueTop: value.top, valueBottom: value.bottom, noteTop: note.top };
    });
    return { boardBottom: board.bottom, queryTop: query.top, queryBottom: query.bottom, tableTop: table.top, cardTops, cardContentFlow };
  });
  if (reconciliationLayout.boardBottom >= reconciliationLayout.queryTop || reconciliationLayout.queryBottom >= reconciliationLayout.tableTop) {
    throw new Error('Reconciliation page order is not KPI board, query form, then table');
  }
  if (reconciliationLayout.cardTops.some(top => Math.abs(top - reconciliationLayout.cardTops[0]) > 1)) {
    throw new Error('Wide reconciliation KPI board does not keep all six cards in one row');
  }
  if (reconciliationLayout.cardContentFlow.some(card => card.valueTop <= card.labelBottom || card.noteTop <= card.valueBottom)) {
    throw new Error('Reconciliation KPI card content does not stack label, value, and note vertically');
  }
  await admin.screenshot({ path: path.join(output, 'admin-api-reconciliation.png'), fullPage: true });

  await admin.click('[data-view="points-accounts"]');
  if ((await admin.locator('[data-view="points-accounts"]').innerText()).trim() !== '积分对账') {
    throw new Error('Points reconciliation navigation label was not renamed');
  }
  const pointsReconciliationBoard = admin.locator('[data-points-reconciliation-kpis]');
  const pointsReconciliationKpis = pointsReconciliationBoard.locator('[data-reconciliation-kpi]');
  if (await pointsReconciliationKpis.count() !== 6) {
    throw new Error('Points reconciliation does not render six KPI cards');
  }
  const pointsReconciliationText = await pointsReconciliationBoard.innerText();
  for (const label of ['本月积分充值', '本月积分消费', '当前可用积分', '当前冻结积分', '本月累计差异', '待核对订单']) {
    if (!pointsReconciliationText.includes(label)) throw new Error(`Points reconciliation KPI board is missing ${label}`);
  }
  if (await pointsReconciliationBoard.locator('[data-reconciliation-kpi-value]').count() !== 6 || await pointsReconciliationBoard.locator('[data-reconciliation-kpi-note]').count() !== 6) {
    throw new Error('Points reconciliation KPI cards do not expose one value and one note each');
  }
  const pointsReconciliationLayout = await admin.evaluate(() => {
    const board = document.querySelector('[data-points-reconciliation-kpis]').getBoundingClientRect();
    const query = document.querySelector('#content [data-query-form]').getBoundingClientRect();
    const table = document.querySelector('#content .table-card').getBoundingClientRect();
    const cardTops = [...document.querySelectorAll('[data-points-reconciliation-kpis] [data-reconciliation-kpi]')].map(element => element.getBoundingClientRect().top);
    return { boardBottom: board.bottom, queryTop: query.top, queryBottom: query.bottom, tableTop: table.top, cardTops };
  });
  if (pointsReconciliationLayout.boardBottom >= pointsReconciliationLayout.queryTop || pointsReconciliationLayout.queryBottom >= pointsReconciliationLayout.tableTop) {
    throw new Error('Points reconciliation page order is not KPI board, query form, then table');
  }
  if (pointsReconciliationLayout.cardTops.some(top => Math.abs(top - pointsReconciliationLayout.cardTops[0]) > 1)) {
    throw new Error('Wide points reconciliation KPI board does not keep all six cards in one row');
  }
  await admin.waitForTimeout(2000);
  await admin.screenshot({ path: path.join(output, 'admin-points-reconciliation.png'), fullPage: true });

  await admin.click('[data-view="api-clients"]');
  if (await admin.locator('[data-reconciliation-kpis]').count()) {
    throw new Error('Reconciliation KPI board leaked into another list page');
  }

  const compactAdmin = await browser.newPage({ viewport: { width: 1024, height: 1000 } });
  watch(compactAdmin);
  await compactAdmin.goto(`file://${path.join(root, 'admin.html')}`);
  await compactAdmin.click('[data-view="channel-analysis"]');
  const compactMetricBox = await compactAdmin.locator('.analysis-metric-panel').boundingBox();
  const compactFlowBox = await compactAdmin.locator('[data-dual-track-flow]').boundingBox();
  if (!compactMetricBox || !compactFlowBox || compactFlowBox.y <= compactMetricBox.y + compactMetricBox.height) {
    throw new Error('Compact channel analysis does not stack metrics above the flow chart');
  }
  const compactWidth = await compactAdmin.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
  if (compactWidth.scroll !== compactWidth.client) {
    throw new Error(`Compact channel analysis overflows horizontally: ${compactWidth.scroll}/${compactWidth.client}`);
  }
  await compactAdmin.click('[data-view="category-mapping"]');
  const compactMappingWidth = await compactAdmin.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
  if (compactMappingWidth.scroll !== compactMappingWidth.client) {
    throw new Error(`Compact category mapping overflows horizontally: ${compactMappingWidth.scroll}/${compactMappingWidth.client}`);
  }
  const compactMappingTrees = await compactAdmin.evaluate(() => {
    const platformTree = document.querySelector('[data-mapping-platform-tree]').getBoundingClientRect();
    const sourceTree = document.querySelector('[data-mapping-source-tree]').getBoundingClientRect();
    return { platformRight: platformTree.right, sourceLeft: sourceTree.left };
  });
  if (compactMappingTrees.platformRight >= compactMappingTrees.sourceLeft) {
    throw new Error('Compact category mapping does not keep the two category trees in left-right comparison');
  }
  if (await compactAdmin.locator('[data-mapping-relation]').count() !== 3) {
    throw new Error('Compact category mapping does not render all visible relation lines');
  }
  await compactAdmin.click('[data-view="api-reconciliation"]');
  const compactReconciliationWidth = await compactAdmin.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
  if (compactReconciliationWidth.scroll !== compactReconciliationWidth.client) {
    throw new Error(`Compact reconciliation page overflows horizontally: ${compactReconciliationWidth.scroll}/${compactReconciliationWidth.client}`);
  }
  const compactReconciliationCards = await compactAdmin.locator('[data-reconciliation-kpi]').evaluateAll(cards => cards.map(card => {
    const box = card.getBoundingClientRect();
    return { top: box.top, bottom: box.bottom };
  }));
  if (compactReconciliationCards.length !== 6
    || compactReconciliationCards.slice(0, 3).some(card => Math.abs(card.top - compactReconciliationCards[0].top) > 1)
    || compactReconciliationCards.slice(3).some(card => Math.abs(card.top - compactReconciliationCards[3].top) > 1)
    || compactReconciliationCards[3].top <= compactReconciliationCards[0].bottom) {
    throw new Error('Compact reconciliation KPI board does not use a three-by-two layout');
  }
  await compactAdmin.screenshot({ path: path.join(output, 'admin-api-reconciliation-compact.png'), fullPage: true });

  await compactAdmin.click('[data-view="points-accounts"]');
  const compactPointsReconciliationWidth = await compactAdmin.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
  if (compactPointsReconciliationWidth.scroll !== compactPointsReconciliationWidth.client) {
    throw new Error(`Compact points reconciliation page overflows horizontally: ${compactPointsReconciliationWidth.scroll}/${compactPointsReconciliationWidth.client}`);
  }
  const compactPointsReconciliationCards = await compactAdmin.locator('[data-points-reconciliation-kpis] [data-reconciliation-kpi]').evaluateAll(cards => cards.map(card => {
    const box = card.getBoundingClientRect();
    return { top: box.top, bottom: box.bottom };
  }));
  if (compactPointsReconciliationCards.length !== 6
    || compactPointsReconciliationCards.slice(0, 3).some(card => Math.abs(card.top - compactPointsReconciliationCards[0].top) > 1)
    || compactPointsReconciliationCards.slice(3).some(card => Math.abs(card.top - compactPointsReconciliationCards[3].top) > 1)
    || compactPointsReconciliationCards[3].top <= compactPointsReconciliationCards[0].bottom) {
    throw new Error('Compact points reconciliation KPI board does not use a three-by-two layout');
  }
  await compactAdmin.screenshot({ path: path.join(output, 'admin-points-reconciliation-compact.png'), fullPage: true });
  await compactAdmin.close();

  await admin.click('[data-view="category"]');
  const categoryText = await admin.locator('#content').innerText();
  if (!categoryText.includes('平台两级分类')) {
    throw new Error('Category page does not describe the approved two-level platform taxonomy');
  }
  for (const requiredText of ['集采商品数', '自营商品数']) {
    if (!categoryText.includes(requiredText)) throw new Error(`Category tree table is missing ${requiredText}`);
  }
  if (await admin.locator('[data-category-add-child]').count()) {
    throw new Error('Category rows still expose a level-two create shortcut');
  }
  if ((await admin.locator('[data-category-add]').innerText()).trim() !== '新增分类') {
    throw new Error('Category page does not expose the unified create entry');
  }
  if (await admin.locator('.tree-node.l3').count()) {
    throw new Error('Category page still renders a third category level');
  }
  const parentSourcingCount = Number(await admin.locator('[data-category-row="office"] [data-sourcing-count]').innerText());
  const childSourcingCounts = await admin.locator('[data-category-child="office"] [data-sourcing-count]').allInnerTexts();
  const sourcingChildTotal = childSourcingCounts.reduce((sum, value) => sum + Number(value), 0);
  const parentSelfCount = Number(await admin.locator('[data-category-row="office"] [data-self-count]').innerText());
  const childSelfCounts = await admin.locator('[data-category-child="office"] [data-self-count]').allInnerTexts();
  const selfChildTotal = childSelfCounts.reduce((sum, value) => sum + Number(value), 0);
  if (parentSourcingCount !== sourcingChildTotal || parentSelfCount !== selfChildTotal) {
    throw new Error('Parent category product counts do not equal the sum of child categories');
  }
  await admin.click('[data-category-toggle="office"]');
  if (await admin.locator('[data-category-child="office"]:not([hidden])').count()) {
    throw new Error('Category parent row did not collapse its children');
  }
  await admin.click('[data-category-toggle="office"]');
  await admin.click('[data-category-edit="office-consumables"]');
  if (!(await admin.locator('[data-category-modal]').isVisible())) {
    throw new Error('Category editor did not open');
  }
  if ((await admin.locator('[data-category-modal] [name="categoryName"]').inputValue()) !== '办公耗材') {
    throw new Error('Category editor did not load the selected category');
  }
  if (!(await admin.locator('[data-category-modal] [name="categoryLevel"]').isDisabled())) {
    throw new Error('Category editor allows an existing category level to change');
  }
  await admin.click('[data-category-modal-close]');

  await admin.click('[data-category-add]');
  const categoryLevelSelect = admin.locator('[data-category-modal] [name="categoryLevel"]');
  if (await categoryLevelSelect.inputValue() !== '1' || await categoryLevelSelect.isDisabled()) {
    throw new Error('New category form does not default to editable level one');
  }
  if (!(await admin.locator('[data-category-parent-field]').isHidden())) {
    throw new Error('Level-one category form still shows the parent category');
  }
  await admin.locator('[data-category-modal] [name="categoryName"]').fill('测试二级分类');
  await admin.locator('[data-category-modal] [name="categoryCode"]').fill('CAT-TEST-02');
  await categoryLevelSelect.selectOption('2');
  if (await admin.locator('[data-category-parent-field]').isHidden()) {
    throw new Error('Level-two create form does not show the parent category');
  }
  await admin.click('[data-category-save]');
  if (!(await admin.locator('#toast').innerText()).includes('请选择所属一级分类')) {
    throw new Error('Level-two category can be saved without a parent');
  }
  await admin.locator('[data-category-modal] [name="categoryParent"]').selectOption('office');
  await admin.click('[data-category-save]');
  if (!(await admin.locator('#content').innerText()).includes('测试二级分类')) {
    throw new Error('Unified category form did not create the level-two category');
  }
  await admin.screenshot({ path: path.join(output, 'admin-category.png'), fullPage: true });

  await admin.click('[data-view="products"]');
  if (!(await admin.locator('#content').innerText()).includes('新建自营商品')) {
    throw new Error('Product management does not expose self-operated product creation');
  }
  const productHeaders = (await admin.locator('#content .data-table thead th').allInnerTexts()).map(text => text.trim());
  if (productHeaders.at(-1) !== '操作') {
    throw new Error('Product management table does not end with an operation column');
  }
  const firstProductActions = (await admin.locator('[data-product-row]').first().locator('[data-product-action]').allInnerTexts()).map(text => text.trim());
  if (JSON.stringify(firstProductActions) !== JSON.stringify(['编辑', '查看SKU', '下架'])) {
    throw new Error(`Product row actions are incomplete: ${firstProductActions.join(', ')}`);
  }
  await admin.locator('[data-product-row]').first().locator('[data-product-action="edit"]').click();
  if (!(await admin.locator('#toast').innerText()).includes('编辑')) {
    throw new Error('Product edit action does not provide operation feedback');
  }
  if (!(await admin.locator('[data-product-category="all"]').evaluate(element => element.classList.contains('active')))) {
    throw new Error('Product category tree does not default to All');
  }
  if ((await admin.locator('[data-product-current-category]').innerText()).trim() !== '全部') {
    throw new Error('Product query form does not show the default category');
  }
  const productSourceFilter = admin.locator('[data-product-source]');
  if (await productSourceFilter.inputValue() !== 'all') {
    throw new Error('Product source filter does not default to all sources');
  }
  const productSourceOptions = (await productSourceFilter.locator('option').allInnerTexts()).map(text => text.trim());
  if (JSON.stringify(productSourceOptions) !== JSON.stringify(['全部来源', '自营商品', '集采商品'])) {
    throw new Error(`Product source options are incomplete: ${productSourceOptions.join(', ')}`);
  }
  if (await admin.locator('#content [data-product-source-tab]').count()) {
    throw new Error('Product management uses source tabs instead of the approved dropdown');
  }
  const productManagementText = await admin.locator('#content').innerText();
  for (const excludedText of ['小程序展示', 'API展示']) {
    if (productManagementText.includes(excludedText)) throw new Error(`Product management still exposes ${excludedText}`);
  }
  if ((await admin.locator('#content').innerText()).includes('未映射')) {
    throw new Error('Unmapped upstream source goods leaked into platform product management');
  }

  await productSourceFilter.selectOption('集采');
  await admin.click('[data-query-submit]');
  const sourcingProductRows = await admin.locator('[data-product-row]').allInnerTexts();
  if (!sourcingProductRows.length || sourcingProductRows.some(text => !text.includes('集采'))) {
    throw new Error('Product source query did not limit the list to sourced products');
  }
  if (sourcingProductRows.some(text => text.includes('未映射'))) {
    throw new Error('Unconsolidated upstream goods entered the platform product list');
  }
  const firstSourcingActions = (await admin.locator('[data-product-row]').first().locator('[data-product-action]').allInnerTexts()).map(text => text.trim());
  if (JSON.stringify(firstSourcingActions) !== JSON.stringify(['查看详情', '查看SKU', '同步信息', '下架'])) {
    throw new Error(`Sourced product row actions are incorrect: ${firstSourcingActions.join(', ')}`);
  }
  await admin.click('[data-query-reset]');
  if (await admin.locator('[data-product-source]').inputValue() !== 'all') {
    throw new Error('Product query reset did not restore all sources');
  }

  await admin.click('[data-product-category="digital"]');
  const parentProductRows = await admin.locator('[data-product-row]').allInnerTexts();
  if (!parentProductRows.some(text => text.includes('无线蓝牙键盘')) || !parentProductRows.some(text => text.includes('便携充电宝'))) {
    throw new Error('Level-one product category does not include all descendant products');
  }
  const selectedBeforeToggle = await admin.locator('[data-product-category].active').getAttribute('data-product-category');
  await admin.click('[data-product-tree-toggle="digital"]');
  const selectedAfterToggle = await admin.locator('[data-product-category].active').getAttribute('data-product-category');
  const rowsAfterToggle = await admin.locator('[data-product-row]').allInnerTexts();
  if (selectedAfterToggle !== selectedBeforeToggle || JSON.stringify(rowsAfterToggle) !== JSON.stringify(parentProductRows)) {
    throw new Error('Product tree expander changed the selected category or refreshed the product result');
  }

  await admin.click('[data-product-category="digital-keyboard"]');
  const childProductRows = await admin.locator('[data-product-row]').allInnerTexts();
  if (!childProductRows.some(text => text.includes('无线蓝牙键盘')) || childProductRows.some(text => text.includes('便携充电宝'))) {
    throw new Error('Level-two product category does not limit products to direct members');
  }
  if ((await admin.locator('[data-product-current-category]').innerText()).trim() !== '键鼠外设') {
    throw new Error('Product query form does not synchronize the selected category');
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
  if (!(await admin.locator('[data-page="1"]').evaluate(element => element.classList.contains('active')))) {
    throw new Error('Product query reset did not return to page 1');
  }
  await admin.screenshot({ path: path.join(output, 'admin-products.png'), fullPage: true });
  await admin.evaluate(() => render('sourcing-products'));
  if (await admin.locator('[data-product-source]').inputValue() !== '集采') {
    throw new Error('Legacy sourcing products route did not preset the sourced product filter');
  }
  if (!(await admin.locator('[data-view="products"]').evaluate(element => element.classList.contains('active')))) {
    throw new Error('Legacy sourcing products route did not redirect to product management');
  }
  await admin.click('[data-query-reset]');

  await admin.click('[data-view="suppliers"]');
  const supplierText = await admin.locator('#content').innerText();
  for (const requiredText of ['API 接入', '小程序展示', 'API展示']) {
    if (!supplierText.includes(requiredText)) throw new Error(`Suppliers page is missing ${requiredText}`);
  }
  const firstSupplierSwitch = admin.locator('#content [data-switch]').first();
  const supplierSwitchWasOn = await firstSupplierSwitch.evaluate(element => element.classList.contains('on'));
  await firstSupplierSwitch.click();
  if ((await firstSupplierSwitch.evaluate(element => element.classList.contains('on'))) === supplierSwitchWasOn) {
    throw new Error('Supplier channel display switch did not update');
  }
  await admin.screenshot({ path: path.join(output, 'admin-suppliers.png'), fullPage: true });
  await admin.click('[data-supplier-sources="京选集采"]');
  const supplierSourceText = await admin.locator('[data-supplier-source-page]').innerText();
  for (const requiredText of ['来源商品编码', '来源分类', '平台商品归集状态', '待映射']) {
    if (!supplierSourceText.includes(requiredText)) throw new Error(`Supplier source goods page is missing ${requiredText}`);
  }
  for (const excludedText of ['小程序展示', 'API展示']) {
    if (supplierSourceText.includes(excludedText)) throw new Error(`Supplier source goods page still exposes ${excludedText}`);
  }
  await admin.screenshot({ path: path.join(output, 'admin-supplier-source-products.png'), fullPage: true });
  await admin.click('[data-supplier-source-back]');
  if (!(await admin.locator('[data-view="suppliers"]').evaluate(element => element.classList.contains('active')))) {
    throw new Error('Supplier source goods back action did not return to the supplier platform list');
  }

  await admin.click('[data-view="category-mapping"]');
  const mappingText = await admin.locator('#content').innerText();
  const mappingTabLabels = await admin.locator('[data-mapping-supplier-tab]').allInnerTexts();
  for (const supplier of ['京选集采', '企采云', '华采供应链']) {
    if (!mappingTabLabels.some(text => text.includes(supplier))) throw new Error(`Category mapping is missing the ${supplier} tab`);
  }
  for (const removedText of ['映射工作区', '待确认', '冲突', '批量映射', '保存映射']) {
    if (mappingText.includes(removedText)) throw new Error(`Category mapping still exposes ${removedText}`);
  }
  const mappingCompare = admin.locator('[data-mapping-compare]');
  const platformMappingTree = admin.locator('[data-mapping-platform-tree]');
  const sourceMappingTree = admin.locator('[data-mapping-source-tree]');
  if (await mappingCompare.count() !== 1 || await platformMappingTree.count() !== 1 || await sourceMappingTree.count() !== 1) {
    throw new Error('Category mapping does not render one left-right tree comparison workspace');
  }
  if (!(await platformMappingTree.innerText()).includes('平台商品分类') || (await platformMappingTree.innerText()).split('\n').some(text => text.trim() === '全部')) {
    throw new Error('Platform mapping tree does not reuse the product category hierarchy without the All node');
  }
  const sourceTreeText = await sourceMappingTree.innerText();
  for (const sourceCategory of ['办公纸品', '键盘', '会议平板', '清洁旧分类']) {
    if (!sourceTreeText.includes(sourceCategory)) throw new Error(`Current supplier source tree is missing ${sourceCategory}`);
  }
  if (await mappingCompare.locator('img').count()) {
    throw new Error('Category mapping comparison still exposes product images');
  }
  if (await mappingCompare.locator('.data-table').count()) {
    throw new Error('Category mapping comparison still uses the old relationship table');
  }
  const relationCount = await admin.locator('[data-mapping-relation]').count();
  if (relationCount !== 3) {
    throw new Error(`JX category mapping renders ${relationCount} relations instead of 3`);
  }
  const relationCounts = await admin.locator('[data-mapping-product-count]').allInnerTexts();
  for (const productCount of ['512 个产品', '286 个产品', '0 个产品']) {
    if (!relationCounts.includes(productCount)) throw new Error(`Category mapping relations are missing ${productCount}`);
  }
  const platformTreeBox = await platformMappingTree.evaluate(element => ({ x: element.getBoundingClientRect().x, width: element.getBoundingClientRect().width }));
  const sourceTreeBox = await sourceMappingTree.evaluate(element => ({ x: element.getBoundingClientRect().x, width: element.getBoundingClientRect().width }));
  if (platformTreeBox.x + platformTreeBox.width >= sourceTreeBox.x) {
    throw new Error('Platform tree is not positioned to the left of the current supplier tree');
  }
  if (await admin.locator('#content [type="checkbox"]').count()) {
    throw new Error('Category mapping still exposes page-level batch selection');
  }
  await admin.screenshot({ path: path.join(output, 'admin-category-mapping.png'), fullPage: true });

  await admin.click('[data-mapping-edit="JX-MEETING"]');
  if (!(await admin.locator('[data-mapping-modal]').isVisible())) {
    throw new Error('Single category mapping editor did not open');
  }
  const mappingEditorText = await admin.locator('[data-mapping-modal]').innerText();
  for (const requiredText of ['会议平板', '有效商品数', '平台一级分类', '平台二级分类']) {
    if (!mappingEditorText.includes(requiredText)) throw new Error(`Mapping editor is missing ${requiredText}`);
  }
  await admin.locator('[data-mapping-platform-parent]').selectOption('digital');
  await admin.locator('[data-mapping-platform-child]').selectOption('digital-keyboard');
  await admin.screenshot({ path: path.join(output, 'admin-category-mapping-edit.png'), fullPage: true });
  await admin.click('[data-mapping-save]');
  if (!(await admin.locator('[data-mapping-row="JX-MEETING"]').innerText()).includes('已映射')) {
    throw new Error('Single category mapping save did not update the source tree node');
  }
  if (await admin.locator('[data-mapping-relation]').count() !== 4) {
    throw new Error('Single category mapping save did not add the relation line');
  }
  await admin.click('[data-mapping-edit="JX-MEETING"]');
  await admin.click('[data-mapping-unbind]');
  if (!(await admin.locator('[data-mapping-unbind-confirmation]').isVisible())) {
    throw new Error('Unbinding a category does not require impact confirmation');
  }
  await admin.click('[data-mapping-unbind-confirm]');
  if (!(await admin.locator('[data-mapping-row="JX-MEETING"]').innerText()).includes('未映射')) {
    throw new Error('Unbinding a category did not return the source tree node to the unmapped view');
  }
  if (await admin.locator('[data-mapping-relation]').count() !== 3) {
    throw new Error('Unbinding a category did not remove the relation line');
  }

  await admin.click('[data-mapping-history="JX-PAPER"]');
  const mappingHistoryText = await admin.locator('[data-mapping-modal]').innerText();
  for (const requiredText of ['映射历史', '新增映射', '手工操作']) {
    if (!mappingHistoryText.includes(requiredText)) throw new Error(`Mapping history is missing ${requiredText}`);
  }
  await admin.click('[data-mapping-modal-close]');

  await admin.click('[data-mapping-supplier-tab="QCY"]');
  const qcyMappingText = await admin.locator('#content').innerText();
  if (!qcyMappingText.includes('企采云') || qcyMappingText.includes('会议平板')) {
    throw new Error('Supplier mapping tab did not isolate the current platform');
  }
  await admin.locator('[data-mapping-status-filter]').selectOption('UNMAPPED');
  await admin.click('[data-query-submit]');
  const unmappedRows = await admin.locator('[data-mapping-row]').allInnerTexts();
  if (!unmappedRows.length || unmappedRows.some(text => !text.includes('未映射'))) {
    throw new Error('Mapping status query includes mapped rows');
  }
  await admin.click('[data-query-reset]');
  if (await admin.locator('[data-mapping-status-filter]').inputValue() !== 'ALL') {
    throw new Error('Mapping reset did not restore all mapping statuses');
  }
  if (!(await admin.locator('[data-mapping-supplier-tab="QCY"]').evaluate(element => element.classList.contains('active')))) {
    throw new Error('Mapping reset did not preserve the current supplier tab');
  }

  await admin.click('[data-mapping-supplier-tab="JX"]');
  await admin.click('[data-mapping-import]');
  if (!(await admin.locator('[data-mapping-import-modal]').isVisible())) {
    throw new Error('Mapping import modal did not open');
  }
  if (!(await admin.locator('[data-mapping-import-modal]').innerText()).includes('京选集采')) {
    throw new Error('Mapping import is not locked to the current supplier');
  }
  await admin.click('[data-mapping-import-preview]');
  const importPreviewText = await admin.locator('[data-mapping-import-modal]').innerText();
  for (const requiredText of ['新增绑定', '修改映射', '解除映射', '无变化', '校验失败', '受影响商品']) {
    if (!importPreviewText.includes(requiredText)) throw new Error(`Mapping import preview is missing ${requiredText}`);
  }
  await admin.screenshot({ path: path.join(output, 'admin-category-mapping-import.png'), fullPage: true });
  await admin.click('[data-mapping-import-execute]');
  const importResultText = await admin.locator('[data-mapping-import-modal]').innerText();
  if (!importResultText.includes('部分成功') || !importResultText.includes('下载失败明细')) {
    throw new Error('Mapping import does not expose partial success and failure details');
  }
  await admin.click('[data-mapping-import-close]');

  await admin.click('[data-mapping-product-link="JX-MEETING"]');
  const mappedSourcePageText = await admin.locator('[data-supplier-source-page]').innerText();
  for (const requiredText of ['京选集采', '数码设备 / 会议平板', '待映射']) {
    if (!mappedSourcePageText.includes(requiredText)) throw new Error(`Mapping product drill-down lost ${requiredText}`);
  }
  await admin.click('[data-supplier-source-back]');
  if (!(await admin.locator('[data-view="category-mapping"]').evaluate(element => element.classList.contains('active')))) {
    throw new Error('Source product drill-down did not return to category mapping');
  }

  await admin.click('[data-view="mini-enterprises"]');
  const miniEnterpriseText = await admin.locator('#content').innerText();
  if (!miniEnterpriseText.includes('企业分类加价') || miniEnterpriseText.includes('小程序 + API')) {
    throw new Error('Mini enterprise list does not retain fixed-channel pricing configuration');
  }

  await admin.click('[data-view="api-clients"]');
  const apiClientText = await admin.locator('#content').innerText();
  if (!apiClientText.includes('API状态') || apiClientText.includes('可用积分')) {
    throw new Error('API client list is not isolated from the miniapp points model');
  }

  const expectedOrderTabs = ['全部', '待处理', '待发货', '已发货', '已完成', '售后/异常'];
  const orderQuickViewCases = {
    'mini-orders': { exceptionText: '退款处理中', exceptionOrder: 'MP202608140180' },
    'api-orders': { exceptionText: '采购失败', exceptionOrder: 'API202608140172' }
  };
  for (const [view, expected] of Object.entries(orderQuickViewCases)) {
    await admin.click(`[data-view="${view}"]`);
    const tabs = admin.locator('[data-order-status-tab]');
    const tabLabels = (await tabs.allInnerTexts()).map(text => text.replace(/\d+/g, '').trim());
    if (JSON.stringify(tabLabels) !== JSON.stringify(expectedOrderTabs)) {
      throw new Error(`${view} quick tabs are incomplete: ${tabLabels.join(', ')}`);
    }
    if (!(await admin.locator('[data-order-status-tab="ALL"]').evaluate(element => element.classList.contains('active')))) {
      throw new Error(`${view} does not default to the All quick view`);
    }
    const tabCounts = (await admin.locator('[data-order-count]').allInnerTexts()).map(value => Number(value));
    if (tabCounts[0] !== tabCounts.slice(1).reduce((total, value) => total + value, 0)) {
      throw new Error(`${view} status counts do not add up to All`);
    }
    if (await admin.locator('[data-query-form] select').count()) {
      throw new Error(`${view} query form still duplicates the order status filter`);
    }

    await admin.click('[data-order-status-tab="PENDING"]');
    const pendingRows = await admin.locator('[data-order-row]').allInnerTexts();
    if (pendingRows.length !== 1 || !pendingRows[0].includes('结果未知')) {
      throw new Error(`${view} pending quick view contains the wrong orders`);
    }
    if (!(await admin.locator('[data-page="1"]').evaluate(element => element.classList.contains('active')))) {
      throw new Error(`${view} status switch did not return to page 1`);
    }

    await admin.click('[data-order-status-tab="AFTER_SALE_OR_EXCEPTION"]');
    const exceptionRows = await admin.locator('[data-order-row]').allInnerTexts();
    if (exceptionRows.length !== 1 || !exceptionRows[0].includes(expected.exceptionText)) {
      throw new Error(`${view} exception quick view contains the wrong orders`);
    }
    await admin.locator('[data-query-form] input').fill(expected.exceptionOrder);
    await admin.click('[data-query-submit]');
    if (!(await admin.locator('[data-order-status-tab="AFTER_SALE_OR_EXCEPTION"]').evaluate(element => element.classList.contains('active')))) {
      throw new Error(`${view} query did not preserve the current quick view`);
    }
    await admin.click('[data-page="2"]');
    await admin.click('[data-query-reset]');
    if ((await admin.locator('[data-query-form] input').inputValue()) !== '') {
      throw new Error(`${view} reset did not clear the keyword`);
    }
    if (!(await admin.locator('[data-order-status-tab="AFTER_SALE_OR_EXCEPTION"]').evaluate(element => element.classList.contains('active')))) {
      throw new Error(`${view} reset did not preserve the current quick view`);
    }
    if (!(await admin.locator('[data-page="1"]').evaluate(element => element.classList.contains('active')))) {
      throw new Error(`${view} reset did not return to page 1`);
    }
    await admin.click('[data-order-status-tab="ALL"]');
    await admin.screenshot({ path: path.join(output, `admin-${view}.png`), fullPage: true });
  }

  await admin.click('[data-view="mini-orders"]');
  if (!(await admin.locator('#content .data-table thead').innerText()).includes('操作')) {
    throw new Error('Mini order table does not expose an operation column');
  }
  const visibleMiniRows = admin.locator('[data-order-row]');
  if (await visibleMiniRows.count() !== await visibleMiniRows.locator('[data-order-actions]').count()) {
    throw new Error('Not every mini order row exposes an action area');
  }
  const miniPendingActions = (await admin.locator('[data-order-row="MP202608140184"] [data-order-action]').allInnerTexts()).map(text => text.trim());
  if (JSON.stringify(miniPendingActions) !== JSON.stringify(['查看详情', '发货', '退款'])) {
    throw new Error(`Pending shipment actions are ${miniPendingActions.join(', ')}`);
  }
  const miniRefundButton = admin.locator('[data-order-row="MP202608140180"] [data-order-action="refund"]');
  if (!(await miniRefundButton.isDisabled()) || (await miniRefundButton.innerText()).trim() !== '退款处理中') {
    throw new Error('Refunding mini order does not expose a disabled progress action');
  }

  await admin.click('[data-order-row="MP202608140184"] [data-order-action="detail"]');
  const orderActionModal = admin.locator('[data-order-action-modal]');
  if (!(await orderActionModal.isVisible()) || !(await orderActionModal.innerText()).includes('MP202608140184')) {
    throw new Error('Mini order detail action does not open the shared detail modal');
  }
  if (await orderActionModal.locator('[data-order-action-submit]').isVisible()) {
    throw new Error('Read-only order detail modal exposes a submit action');
  }
  await admin.click('[data-order-action-close]');

  const beforeShipCounts = Object.fromEntries(await admin.locator('[data-order-status-tab]').evaluateAll(tabs => tabs.map(tab => [tab.dataset.orderStatusTab, Number(tab.querySelector('[data-order-count]').textContent)])));
  await admin.click('[data-order-row="MP202608140184"] [data-order-action="ship"]');
  await admin.click('[data-order-action-submit]');
  if (!(await admin.locator('[data-order-action-error]').innerText()).includes('请选择物流公司')) {
    throw new Error('Shipping accepted an empty logistics company');
  }
  await admin.locator('[data-order-logistics-company]').selectOption('顺丰速运');
  await admin.click('[data-order-action-submit]');
  if (!(await admin.locator('[data-order-action-error]').innerText()).includes('请输入物流单号')) {
    throw new Error('Shipping accepted an empty tracking number');
  }
  await admin.locator('[data-order-tracking-number]').fill('SF1234567890');
  await admin.click('[data-order-action-submit]');
  const shippedMiniRow = admin.locator('[data-order-row="MP202608140184"]');
  if (!(await shippedMiniRow.innerText()).includes('已发货')) {
    throw new Error('Shipping did not update the mini order status');
  }
  const shippedMiniActions = (await shippedMiniRow.locator('[data-order-action]').allInnerTexts()).map(text => text.trim());
  if (JSON.stringify(shippedMiniActions) !== JSON.stringify(['查看详情', '退款'])) {
    throw new Error(`Shipped mini order actions are ${shippedMiniActions.join(', ')}`);
  }
  const afterShipCounts = Object.fromEntries(await admin.locator('[data-order-status-tab]').evaluateAll(tabs => tabs.map(tab => [tab.dataset.orderStatusTab, Number(tab.querySelector('[data-order-count]').textContent)])));
  if (afterShipCounts.TO_SHIP !== beforeShipCounts.TO_SHIP - 1 || afterShipCounts.SHIPPED !== beforeShipCounts.SHIPPED + 1) {
    throw new Error('Shipping did not refresh order quick-view counts');
  }
  await shippedMiniRow.locator('[data-order-action="refund"]').click();
  if (!(await orderActionModal.innerText()).includes('按原积分及支付路径退回')) {
    throw new Error('Mini order refund does not explain the original points/payment path');
  }
  await admin.click('[data-order-action-close]');

  await admin.click('[data-view="api-orders"]');
  if (!(await admin.locator('#content .data-table thead').innerText()).includes('操作')) {
    throw new Error('API order table does not expose an operation column');
  }
  const apiFailedActions = (await admin.locator('[data-order-row="API202608140172"] [data-order-action]').allInnerTexts()).map(text => text.trim());
  if (JSON.stringify(apiFailedActions) !== JSON.stringify(['查看详情', '关闭订单'])) {
    throw new Error(`Failed API order actions are ${apiFailedActions.join(', ')}`);
  }
  await admin.click('[data-order-row="API202608140181"] [data-order-action="refund"]');
  if (!(await orderActionModal.innerText()).includes('按原人民币结算路径退回')) {
    throw new Error('API order refund does not explain the original RMB settlement path');
  }
  await admin.click('[data-order-action-submit]');
  if (!(await admin.locator('[data-order-action-error]').innerText()).includes('请填写退款原因')) {
    throw new Error('Refund accepted an empty reason');
  }
  await admin.locator('[data-order-refund-reason]').fill('客户确认取消采购');
  await admin.click('[data-order-action-submit]');
  if (!(await admin.locator('[data-order-action-error]').innerText()).includes('请确认退款影响')) {
    throw new Error('Refund did not require impact confirmation');
  }
  await admin.locator('[data-order-action-confirm]').check();
  await admin.click('[data-order-action-submit]');
  const refundedApiRow = admin.locator('[data-order-row="API202608140181"]');
  if (!(await refundedApiRow.innerText()).includes('退款中') || !(await refundedApiRow.innerText()).includes('退款处理中')) {
    throw new Error('Refund did not update the API order status');
  }
  const refundedApiButton = refundedApiRow.locator('[data-order-action="refund"]');
  if (!(await refundedApiButton.isDisabled()) || (await refundedApiButton.innerText()).trim() !== '退款处理中') {
    throw new Error('Refunded API order does not disable the repeated refund action');
  }

  await admin.click('[data-order-row="API202608140172"] [data-order-action="close"]');
  await admin.click('[data-order-action-submit]');
  if (!(await admin.locator('[data-order-action-error]').innerText()).includes('请选择关闭原因')) {
    throw new Error('Closing accepted an empty reason');
  }
  await admin.locator('[data-order-close-reason]').selectOption('采购失败不再重试');
  await admin.click('[data-order-action-submit]');
  if (!(await admin.locator('[data-order-action-error]').innerText()).includes('请确认关闭订单')) {
    throw new Error('Closing did not require confirmation');
  }
  await admin.locator('[data-order-action-confirm]').check();
  await admin.click('[data-order-action-submit]');
  const closedApiRow = admin.locator('[data-order-row="API202608140172"]');
  if (!(await closedApiRow.innerText()).includes('已取消') || !(await closedApiRow.innerText()).includes('已关闭')) {
    throw new Error('Closing did not update the API order status');
  }
  const closedApiActions = (await closedApiRow.locator('[data-order-action]').allInnerTexts()).map(text => text.trim());
  if (JSON.stringify(closedApiActions) !== JSON.stringify(['查看详情'])) {
    throw new Error(`Cancelled API order actions are ${closedApiActions.join(', ')}`);
  }
  await admin.click('[data-order-status-tab="PENDING"]');
  if (await admin.locator('[data-order-row="API202608140172"]').count()) {
    throw new Error('Cancelled API order leaked into the pending quick view');
  }
  await admin.click('[data-order-status-tab="ALL"]');
  await admin.screenshot({ path: path.join(output, 'admin-api-orders-actions.png'), fullPage: true });

  await admin.click('[data-view="system-users"]');
  const systemUserText = await admin.locator('#content').innerText();
  if (!systemUserText.includes('平台内部后台账号')) {
    throw new Error('User management scope is unclear');
  }
  for (const action of ['编辑', '停用', '重置密码']) {
    if (!systemUserText.includes(action)) throw new Error(`User management is missing ${action}`);
  }
  const userQueryButtons = (await admin.locator('[data-query-form] button').allInnerTexts()).map(text => text.trim());
  if (JSON.stringify(userQueryButtons) !== JSON.stringify(['查询', '重置'])) {
    throw new Error(`User management query buttons are ${userQueryButtons.join(', ')}`);
  }
  await admin.click('[data-user-add]');
  if (!(await admin.locator('[data-user-modal]').isVisible())) {
    throw new Error('User modal did not open');
  }
  if (await admin.locator('[data-user-modal] [name="userRole"]').getAttribute('multiple') !== null) {
    throw new Error('User management allows multiple roles');
  }
  await admin.locator('[data-user-modal] [name="userName"]').fill('财务专员');
  await admin.locator('[data-user-modal] [name="userLoginName"]').fill('finance_ops');
  await admin.locator('[data-user-modal] [name="userMobile"]').fill('13800000009');
  await admin.locator('[data-user-modal] [name="userRole"]').selectOption('ROLE-MALL');
  await admin.locator('[data-user-modal] [name="userPassword"]').fill('Temp123456');
  await admin.click('[data-user-save]');
  if (!(await admin.locator('#content').innerText()).includes('finance_ops')) {
    throw new Error('New system user was not added to the list');
  }
  await admin.click('[data-user-status="USR-003"]');
  if (!(await admin.locator('[data-user-row="USR-003"]').innerText()).includes('启用')) {
    throw new Error('System user status did not update');
  }
  await admin.click('[data-user-reset-password="USR-002"]');
  if (!(await admin.locator('#toast').innerText()).includes('密码已重置')) {
    throw new Error('Password reset did not provide clear feedback');
  }
  await admin.screenshot({ path: path.join(output, 'admin-system-users.png'), fullPage: true });

  await admin.click('[data-view="system-roles"]');
  const superAdminRow = admin.locator('[data-role-row="ROLE-SUPER"]');
  if (!(await superAdminRow.innerText()).includes('全部菜单')) {
    throw new Error('Super administrator does not show immutable full menu access');
  }
  if (await superAdminRow.locator('[data-role-status]').count()) {
    throw new Error('Super administrator exposes a disable action');
  }
  await admin.click('[data-role-edit="ROLE-OPS"]');
  if (!(await admin.locator('[data-permission-tree]').isVisible())) {
    throw new Error('Permission tree did not open');
  }
  const apiOrderPermission = admin.locator('[data-permission-child="api-orders"]');
  if (!(await apiOrderPermission.isChecked())) {
    throw new Error('Supply operations fixture does not include API orders');
  }
  const productPermission = admin.locator('[data-permission-child="products"]');
  if (!(await productPermission.isChecked())) {
    throw new Error('Legacy sourcing product permission was not migrated to product management');
  }
  if (await admin.locator('[data-permission-child="sourcing-products"]').count()) {
    throw new Error('Deleted sourcing product permission is still present');
  }
  await admin.screenshot({ path: path.join(output, 'admin-system-role-permissions.png'), fullPage: true });
  await apiOrderPermission.uncheck();
  if (!(await admin.locator('[data-permission-parent="api"]').evaluate(element => element.indeterminate))) {
    throw new Error('Permission parent did not enter the partial state');
  }
  await admin.click('[data-role-save]');
  if (!(await admin.locator('#toast').innerText()).includes('角色权限已保存')) {
    throw new Error('Role menu permissions were not saved');
  }
  await admin.click('[data-role-status="ROLE-OPS"]');
  if (!(await admin.locator('[data-role-row="ROLE-OPS"]').innerText()).includes('停用')) {
    throw new Error('Role status did not update');
  }
  await admin.click('[data-role-status="ROLE-OPS"]');
  await admin.screenshot({ path: path.join(output, 'admin-system-roles.png'), fullPage: true });
  await admin.setViewportSize({ width: 1024, height: 768 });
  if (await admin.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)) {
    throw new Error('System management overflows horizontally at 1024px');
  }
  await admin.setViewportSize({ width: 1440, height: 1000 });

  await admin.click('[data-view="system-api-docs"]');
  const apiDocAdminText = await admin.locator('#content').innerText();
  for (const requiredText of ['公开地址', '当前版本', '公开访问', '十个章节']) {
    if (!apiDocAdminText.includes(requiredText)) throw new Error(`API doc admin page is missing ${requiredText}`);
  }
  if (apiDocAdminText.includes('file:///') || apiDocAdminText.includes('/Users/')) {
    throw new Error('API doc admin page leaks the local prototype file path');
  }
  if (apiDocAdminText.includes('访问密码') || apiDocAdminText.includes('有效期') || apiDocAdminText.includes('分享记录')) {
    throw new Error('API doc admin page exposes excluded share governance fields');
  }
  const apiDocMetaBoxes = await admin.locator('[data-api-doc-admin] .detail-item').evaluateAll(items => items.map(item => {
    const box = item.getBoundingClientRect();
    return { top: box.top, left: box.left };
  }));
  if (apiDocMetaBoxes.length !== 4 || apiDocMetaBoxes.some(box => Math.abs(box.top - apiDocMetaBoxes[0].top) > 1)) {
    throw new Error('API doc metadata does not stay in one compact row');
  }
  await admin.click('[data-api-doc-copy]');
  await admin.waitForFunction(() => document.querySelector('#toast')?.textContent.includes('公开链接已复制'));
  if (!(await admin.locator('#toast').innerText()).includes('公开链接已复制')) {
    throw new Error('Public API doc link was not copied');
  }
  await admin.screenshot({ path: path.join(output, 'admin-api-docs.png'), fullPage: true });

  const queryListViews = [
    'mini-enterprises', 'mini-orders', 'points-accounts',
    'api-clients', 'api-orders', 'api-reconciliation',
    'category', 'products', 'suppliers', 'category-mapping',
    'system-users', 'system-roles'
  ];
  for (const view of queryListViews) {
    await admin.click(`[data-view="${view}"]`);
    if (await admin.locator('#content .table-summary').count()) {
      throw new Error(`${view} still renders a table summary header`);
    }
    const queryForm = admin.locator('#content [data-query-form]');
    if (await queryForm.count() !== 1) {
      throw new Error(`${view} does not render exactly one unified query form`);
    }
    const queryButtons = (await queryForm.locator('button').allInnerTexts()).map(text => text.trim());
    if (JSON.stringify(queryButtons) !== JSON.stringify(['查询', '重置'])) {
      throw new Error(`${view} query buttons are ${queryButtons.join(', ')}`);
    }
    const queryButtonBoxes = await queryForm.locator('button').evaluateAll(buttons => buttons.map(button => {
      const box = button.getBoundingClientRect();
      return { top: box.top, bottom: box.bottom };
    }));
    if (Math.abs(queryButtonBoxes[0].top - queryButtonBoxes[1].top) > 1) {
      throw new Error(`${view} query and reset buttons do not stay on the same row`);
    }
    const firstInput = queryForm.locator('input').first();
    if (await firstInput.count()) await firstInput.fill('临时查询条件');
    const firstSelect = queryForm.locator('select').first();
    if (await firstSelect.count()) await firstSelect.selectOption({ index: 1 });
    const secondPage = admin.locator('#content [data-page="2"]');
    if (await secondPage.count()) await secondPage.click();
    await queryForm.locator('[data-query-reset]').click();
    const refreshedForm = admin.locator('#content [data-query-form]');
    const refreshedInput = refreshedForm.locator('input').first();
    if (await refreshedInput.count() && await refreshedInput.inputValue() !== '') {
      throw new Error(`${view} reset did not clear the query input`);
    }
    const refreshedSelect = refreshedForm.locator('select').first();
    if (await refreshedSelect.count() && await refreshedSelect.evaluate(element => element.selectedIndex) !== 0) {
      throw new Error(`${view} reset did not restore the default select option`);
    }
    const firstPage = admin.locator('#content [data-page="1"]');
    if (await firstPage.count() && !(await firstPage.evaluate(element => element.classList.contains('active')))) {
      throw new Error(`${view} reset did not return pagination to page 1`);
    }
  }

  await admin.click('[data-view="mini-orders"]');
  await admin.click('[data-page="2"]');
  if (!(await admin.locator('[data-page="2"]').evaluate(el => el.classList.contains('active')))) {
    throw new Error('Admin pagination did not activate page 2');
  }
  await admin.setViewportSize({ width: 1024, height: 768 });
  if (await admin.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)) {
    throw new Error('Admin prototype overflows horizontally at 1024px');
  }

  const mini = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  watch(mini);
  await mini.goto(`file://${path.join(root, 'miniapp.html')}`);
  await mini.waitForTimeout(250);
  await mini.screenshot({ path: path.join(output, 'miniapp-home.png') });
  await mini.click('[data-screen="home"] [data-open="product"]');
  await mini.click('[data-screen="product"] [data-open="checkout"]');
  await mini.click('#confirmRedeem');
  await mini.waitForSelector('[data-screen="success"].active');
  await mini.waitForTimeout(250);
  await mini.screenshot({ path: path.join(output, 'miniapp-success.png') });
  await mini.click('[data-screen="success"] [data-open="orders"]');
  if (!(await mini.locator('[data-screen="orders"]').evaluate(el => el.classList.contains('active')))) {
    throw new Error('Miniapp success flow did not navigate to orders');
  }
  if (await mini.locator('.order-card[data-order-status="处理中"]').count() < 1) {
    throw new Error('Submitted redemption did not create a visible processing order');
  }

  await mini.click('.filter-tab[data-filter="待发货"]');
  const visibleStatuses = await mini.locator('.order-card:not([hidden])').evaluateAll(cards => cards.map(card => card.dataset.orderStatus));
  if (!visibleStatuses.length || visibleStatuses.some(status => status !== '待发货')) {
    throw new Error('Order filter did not limit visible cards to the selected status');
  }

  await mini.click('[data-tab="profile"]');
  if ((await mini.locator('[data-account-available]').innerText()).trim() !== '111,800') {
    throw new Error('Available points were not reduced after redemption submission');
  }
  if ((await mini.locator('[data-account-frozen]').innerText()).trim() !== '19,600') {
    throw new Error('Frozen points were not increased after redemption submission');
  }
  await mini.waitForTimeout(250);
  await mini.screenshot({ path: path.join(output, 'miniapp-profile-state.png'), fullPage: true });
  await mini.setViewportSize({ width: 360, height: 780 });
  if (await mini.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)) {
    throw new Error('Miniapp prototype overflows horizontally at 360px');
  }

  const docs = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  watch(docs);
  await docs.goto(`file://${path.join(root, 'api-docs.html')}`);
  await docs.waitForTimeout(250);
  if (await docs.locator('[data-doc-section]').count() !== 10) {
    throw new Error('Public API documentation does not contain exactly ten chapters');
  }
  const publicDocText = await docs.locator('body').innerText();
  for (const requiredText of ['拾马商城开放接口文档', '原型示例', '创建订单', '账户余额查询', '公共错误码']) {
    if (!publicDocText.includes(requiredText)) throw new Error(`Public API documentation is missing ${requiredText}`);
  }
  if (publicDocText.includes('平台运营后台')) {
    throw new Error('Public API documentation reuses the internal admin shell');
  }
  await docs.locator('[data-doc-search]').fill('库存');
  const visibleInventoryEntries = await docs.locator('[data-doc-entry]:not([hidden])').allInnerTexts();
  if (!visibleInventoryEntries.length || visibleInventoryEntries.some(text => !text.includes('库存'))) {
    throw new Error('Public API documentation search did not isolate inventory entries');
  }
  await docs.locator('[data-doc-search]').fill('不存在的接口');
  if (!(await docs.locator('[data-doc-empty]').isVisible())) {
    throw new Error('Public API documentation search does not expose an empty state');
  }
  await docs.locator('[data-doc-search]').fill('');
  await docs.click('[data-doc-link="orders-create"]');
  await docs.locator('[data-code-copy]').first().click();
  await docs.waitForFunction(() => document.querySelector('[data-code-copy]')?.textContent.trim() === '已复制');
  if ((await docs.locator('[data-code-copy]').first().innerText()).trim() !== '已复制') {
    throw new Error('Public API documentation code copy lacks success feedback');
  }
  await docs.screenshot({ path: path.join(output, 'public-api-docs.png'), fullPage: true });
  await docs.setViewportSize({ width: 390, height: 844 });
  if (!(await docs.locator('[data-doc-menu]').isVisible())) {
    throw new Error('Public API documentation mobile menu trigger is hidden');
  }
  await docs.click('[data-doc-menu]');
  if (!(await docs.locator('[data-doc-toc]').evaluate(element => element.classList.contains('open')))) {
    throw new Error('Public API documentation mobile directory did not open');
  }
  await docs.screenshot({ path: path.join(output, 'public-api-docs-mobile.png'), fullPage: true });
  if (await docs.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)) {
    throw new Error('Public API documentation overflows horizontally at mobile width');
  }

  const review = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  watch(review);
  await review.goto(`file://${path.join(root, 'review.html')}`);
  await review.waitForFunction(() => [...document.images].every(image => image.complete && image.naturalWidth > 0));
  if (!(await review.locator('body').innerText()).includes('业务闭环评审')) {
    throw new Error('Local review entry did not render');
  }
  await review.screenshot({ path: path.join(output, 'review.png'), fullPage: true });
  await review.setViewportSize({ width: 390, height: 844 });
  if (await review.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)) {
    throw new Error('Review page overflows horizontally at mobile width');
  }
  if (runtimeErrors.length) {
    throw new Error(`Browser runtime errors: ${runtimeErrors.join(' | ')}`);
  }

  console.log('visual-check: admin navigation/pagination and miniapp redemption flow passed');
  await browser.close();
})().catch(error => {
  console.error(error);
  process.exit(1);
});
