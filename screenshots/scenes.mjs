// Every screenshot: who is signed in (seed.mjs users), where the page starts, what to
// do. Pages open in the target language; L() gives the UI text a selector needs in that
// language (from the app's i18n.ts). Wait only for things that are in the recording.
const TR = {
  'Columns': 'Sütunlar', 'Logs': 'Loglar', 'Shell': 'Shell', 'Before last restart': 'Son restart öncesi',
  'YAML': 'YAML', 'Edit': 'Düzenle', 'Dry-run': 'Dry-run', 'Restart': 'Yeniden başlat', 'Scale': 'Ölçekle',
  'Keys': 'Anahtarlar', 'Show': 'Göster', 'Details': 'Ayrıntılar', 'LDAP Configuration': 'LDAP Yapılandırması',
  'Azure AD Configuration': 'Azure AD Yapılandırması', 'User Base DN (single)': 'Kullanıcı Base DN (tek)',
  'User Filter': 'Kullanıcı filtresi', 'Add permissions': 'İzin ekle', 'Revisions': 'Revizyonlar',
  'pod.* = all': 'pod.* = hepsi',
};
let LOCALE = 'en';
export const setLocale = (locale) => { LOCALE = locale; };
const esc = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// Some labels stay English in the Turkish UI (row buttons), so a selector accepts both.
const L = (en) => (LOCALE === 'tr' && TR[en] ? new RegExp(`^(${esc(TR[en])}|${esc(en)})$`) : en);
const Li = (en) => new RegExp(LOCALE === 'tr' && TR[en] ? `${esc(TR[en])}|${esc(en)}` : esc(en), 'i');
const row = (page, text) => page.locator('tbody tr', {hasText: text}).first();
const shop = (tab) => ({dashboardNamespace: 'shop', dashboardResourceTab: tab});
const dialog = (page) => page.locator('[role=dialog]').last();
// drawers and dialogs open scrolled to their top
const toTop = (page) => page.evaluate(() => { document.querySelectorAll('*').forEach((el) => { if (el.scrollTop) el.scrollTop = 0; }); window.scrollTo(0, 0); });
// fill the n-th text input of the page (labels are not tied to inputs everywhere)
const fillNth = async (page, n, value) => page.locator('main input[type=text], main input:not([type])').nth(n).fill(value);
const admin = (tab) => ({adminActiveTab: tab});

export const SCENES = [
  // ── User guide ──────────────────────────────────────────────────────────
  {id: 'login', as: null, path: '/login',
    run: async (page) => { await page.locator('input[type=password]').waitFor(); }},
  {id: 'dashboard-pods', as: 'alice', storage: shop('pods'),
    run: async (page) => { await row(page, 'catalog-').waitFor(); }},
  {id: 'dashboard-cards', as: 'alice', storage: {...shop('pods'), dashboardViewMode: 'card'},
    run: async (page) => { await page.getByText(/^catalog-/).first().waitFor(); }},
  {id: 'dashboard-columns', as: 'alice', storage: shop('pods'),
    run: async (page) => {
      await row(page, 'catalog-').waitFor();
      await page.getByRole('button', {name: L('Columns')}).click();
      await page.getByRole('menu').waitFor();
      await page.waitForTimeout(1500); // the menu settles next to its button
    }},
  {id: 'dashboard-search', as: 'alice', storage: shop('pods'),
    run: async (page) => {
      await row(page, 'catalog-').waitFor();
      await page.keyboard.press('/');
      await page.keyboard.type('label:tier=web');
      await page.waitForTimeout(300);
    }},
  {id: 'cluster-switcher', as: 'alice', storage: shop('pods'),
    run: async (page) => {
      await row(page, 'catalog-').waitFor();
      await page.keyboard.press('c');
      await page.getByText('prod-eu').last().waitFor();
    }},
  {id: 'pod-drawer', as: 'alice', storage: shop('pods'),
    run: async (page) => {
      await row(page, 'checkout-').click();
      await page.locator('[role=dialog]').getByText('OOMKilled').first().waitFor();
      await page.waitForTimeout(500);
      await toTop(page);
    }},
  {id: 'dashboard-deployments', as: 'alice', storage: shop('deployments'),
    run: async (page) => { await row(page, 'storefront').waitFor(); }},
  {id: 'deployment-drawer', as: 'alice', storage: shop('deployments'),
    run: async (page) => {
      await row(page, 'storefront').click();
      await dialog(page).getByText(Li('Revisions')).first().waitFor();
      await page.waitForTimeout(800);
      await toTop(page);
    }},
  {id: 'logs', tolerance: 0.05, /* log lines render in batches */ as: 'alice', storage: shop('pods'),
    run: async (page) => {
      await row(page, 'storefront-').getByRole('button', {name: L('Logs')}).click();
      await page.getByText('GET /products').first().waitFor();
      await page.waitForTimeout(2000); // every replayed frame rendered and scrolled
    }},
  {id: 'shell', tolerance: 0.05, /* the terminal draws asynchronously */ as: 'alice', storage: shop('pods'),
    run: async (page, {mode}) => {
      await row(page, 'storefront-').getByRole('button', {name: L('Shell')}).click();
      await page.locator('.xterm').waitFor();
      await page.waitForTimeout(1500);
      if (mode === 'record') {
        await page.locator('.xterm').click();
        await page.keyboard.type('hostname && ls /\n');
        await page.waitForTimeout(1500);
      } else {
        await page.waitForTimeout(800);
      }
    }},
  {id: 'views-menu', as: 'alice', storage: shop('pods'),
    run: async (page) => {
      await row(page, 'catalog-').waitFor();
      await page.keyboard.press('v');
      await page.getByText('Shop · web tier').waitFor();
    }},
  {id: 'live-events', as: 'alice', storage: shop('pods'),
    run: async (page, {mode}) => {
      await row(page, 'catalog-').waitFor();
      await page.keyboard.press('e');
      if (mode === 'record') {
        // something to show: restart a workload alice may restart on staging
        await page.evaluate(() => fetch('/api/namespaces/shop/deployments/checkout/restart', {method: 'POST',
          headers: {Authorization: `Bearer ${localStorage.getItem('authToken')}`}}));
        await page.waitForTimeout(12000);
      } else {
        await page.waitForTimeout(1500);
      }
    }},
  {id: 'shortcuts', as: 'alice', storage: shop('pods'),
    run: async (page) => {
      await row(page, 'catalog-').waitFor();
      await page.keyboard.press('?');
      await dialog(page).waitFor();
    }},
  {id: 'logs-previous', tolerance: 0.05, /* log lines render in batches */ as: 'alice', storage: shop('pods'),
    run: async (page) => {
      await row(page, 'catalog-').getByRole('button', {name: L('Logs')}).click();
      await page.getByRole('button', {name: L('Before last restart')}).click();
      await page.getByText('connection refused').first().waitFor();
      await page.waitForTimeout(1500);
    }},
  {id: 'yaml-view', as: 'alice', storage: shop('configmaps'),
    run: async (page) => {
      await row(page, 'storefront-config').getByRole('button', {name: L('YAML')}).click();
      await page.locator('.monaco-editor').first().waitFor();
      await page.waitForTimeout(1500);
    }},
  {id: 'yaml-diff', as: 'alice', storage: shop('configmaps'),
    run: async (page) => {
      await row(page, 'storefront-config').getByRole('button', {name: L('YAML')}).click();
      await page.getByRole('button', {name: L('Edit')}).click();
      const line = page.locator('.editor.modified .view-line', {hasText: 'LOG_LEVEL'}).first();
      await line.waitFor();
      await line.getByText('info', {exact: true}).dblclick();
      await page.keyboard.type('warn'); // no "e": 2.22.0 takes it as the Live Events shortcut in the editor
      await page.getByRole('button', {name: L('Dry-run')}).click();
      await page.waitForTimeout(2500);
    }},
  {id: 'restart-confirm', as: 'alice', storage: shop('deployments'),
    run: async (page) => {
      await row(page, 'storefront').getByRole('button', {name: L('Restart')}).click();
      await dialog(page).waitFor();
    }},
  {id: 'scale-dialog', as: 'alice', storage: shop('deployments'),
    run: async (page) => {
      await row(page, 'storefront').click();
      await dialog(page).getByRole('button', {name: L('Scale')}).click();
      await page.waitForTimeout(500);
    }},
  {id: 'secrets-list', as: 'alice', storage: shop('secrets'),
    run: async (page) => { await row(page, 'storefront-db').waitFor(); }},
  {id: 'secret-reveal', as: 'alice', storage: shop('secrets'),
    run: async (page) => {
      await row(page, 'storefront-db').getByRole('button', {name: L('Keys')}).click();
      await dialog(page).getByText('username').waitFor();
      await dialog(page).getByRole('button', {name: Li('Show')}).first().click();
      await page.waitForTimeout(800);
    }},
  {id: 'api-keys', as: 'alice', path: '/account/api-keys',
    run: async (page) => { await page.getByText('claude-code').first().waitFor(); }},
  {id: 'api-key-form', as: 'alice', path: '/account/api-keys/new',
    run: async (page) => {
      await page.locator('input').first().waitFor();
      await page.locator('input').first().fill('grafana-alerts');
      await page.waitForTimeout(1500);
    }},

  // ── Administration ──────────────────────────────────────────────────────
  {id: 'overview', tolerance: 0.02, /* charts */ as: 'admin', path: '/overview',
    run: async (page) => { await page.waitForTimeout(4000); }},
  {id: 'nodes', as: 'admin', path: '/nodes',
    run: async (page) => { await row(page, 'k3d-oc-docs').waitFor(); await page.waitForTimeout(800); }},
  {id: 'node-drawer', as: 'admin', path: '/nodes?node=k3d-oc-docs-server-0',
    run: async (page) => { await dialog(page).waitFor(); await page.waitForTimeout(2500); await toTop(page); }},
  {id: 'admin-users', as: 'admin', path: '/admin', storage: admin('users'),
    run: async (page) => { await row(page, 'alice').waitFor(); }},
  {id: 'admin-user-edit', as: 'admin', path: '/admin', storage: admin('users'),
    run: async (page) => {
      await row(page, 'alice').getByRole('button', {name: Li('Edit')}).first().click();
      await dialog(page).waitFor();
      await page.waitForTimeout(800);
    }},
  {id: 'admin-groups', as: 'admin', path: '/admin', storage: admin('groups'),
    run: async (page) => { await row(page, 'shop-team').waitFor(); }},
  {id: 'admin-roles', as: 'admin', path: '/admin', storage: admin('roles'),
    run: async (page) => {
      await page.getByText('shop-developer').nth(1).click();
      await page.waitForTimeout(1200);
    }},
  {id: 'admin-add-permissions', as: 'admin', path: '/admin', storage: admin('roles'), viewport: {width: 1440, height: 1200},
    run: async (page) => {
      await page.getByText('shop-developer').nth(1).click();
      await page.getByRole('button', {name: Li('Add permissions')}).first().click();
      await dialog(page).waitFor();
      await page.waitForTimeout(800);
      await toTop(page);
    }},
  {id: 'admin-clusters', as: 'admin', path: '/admin', storage: admin('clusters'),
    run: async (page) => { await page.getByText('prod-eu').first().waitFor(); await page.waitForTimeout(800); }},
  {id: 'admin-ldap', as: 'admin', path: '/admin', storage: admin('ldap'), viewport: {width: 1440, height: 1000},
    run: async (page) => {
      await page.getByText(L('LDAP Configuration')).waitFor();
      await page.waitForTimeout(2000); // the saved settings load into the form
      // example values, not saved
      const set = (label, v) => page.locator('label', {hasText: label}).locator('xpath=..').locator('input').first().fill(v);
      await set('Host', 'dc01.example.corp');
      await set('Bind DN', 'CN=svc-openconsole,OU=ServiceAccounts,DC=example,DC=corp');
      await set(Li('User Base DN (single)'), 'OU=Users,DC=example,DC=corp');
      await set(Li('User Filter'), '(sAMAccountName=%s)');
      await toTop(page);
      await page.waitForTimeout(500);
    }},
  {id: 'admin-azure', as: 'admin', path: '/admin', storage: admin('azure-ad'),
    run: async (page) => {
      await page.getByText(L('Azure AD Configuration')).waitFor();
      await page.waitForTimeout(2000);
      const set = (label, v) => page.locator('label', {hasText: label}).locator('xpath=..').locator('input').first().fill(v);
      await set('Tenant ID', '00000000-1111-2222-3333-444444444444');
      await set('Client ID', 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee');
      await set('Redirect URL', 'https://openconsole.example.com/api/auth/azure/callback');
      await page.waitForTimeout(500);
    }},
  {id: 'recording-player', tolerance: 0.05, /* the player draws asynchronously */ as: 'admin', path: '/admin', storage: admin('recordings'), viewport: {width: 1440, height: 1000},
    run: async (page) => {
      await page.locator('tbody tr').first().waitFor();
      await page.locator('tbody tr').first().getByRole('button').first().click();
      await dialog(page).waitFor();
      await page.waitForTimeout(2500);
      await toTop(page);
    }},
  {id: 'admin-sessions', as: 'admin', path: '/admin', storage: admin('sessions'),
    run: async (page) => { await row(page, 'alice').waitFor(); }},
  {id: 'admin-session-settings', as: 'admin', path: '/admin', storage: admin('session'),
    run: async (page) => { await page.waitForTimeout(1500); }},
  {id: 'admin-recordings', tolerance: 0.02, /* disk usage bar */ as: 'admin', path: '/admin', storage: admin('recordings'),
    run: async (page) => { await row(page, 'alice').waitFor(); }},
  {id: 'admin-api-keys', as: 'admin', path: '/admin', storage: admin('api-keys'),
    run: async (page) => { await row(page, 'claude-code').waitFor(); }},
  {id: 'admin-audit', as: 'admin', path: '/admin', storage: admin('audit'),
    run: async (page) => {
      await page.getByText(L('Details'), {exact: true}).first().waitFor();
      await page.getByPlaceholder(Li('pod.* = all')).fill('deployment.*');
      await page.keyboard.press('Enter');
      await page.getByText('shop/storefront').first().waitFor();
      await page.waitForTimeout(800);
      // the details of alice's refused restart
      await page.locator('div', {hasText: /^alice\s*deployment\.restart\s*denied/}).last().getByText(L('Details'), {exact: true}).click().catch(() => page.getByText(L('Details'), {exact: true}).nth(1).click());
      await page.waitForTimeout(500);
    }},
  {id: 'admin-customization', as: 'admin', path: '/admin', storage: admin('customization'),
    run: async (page) => { await page.waitForTimeout(1500); }},
];
