// Fills a fresh OpenConsole (from cluster.sh) with the users, roles, clusters and
// activity the screenshots show. All names are fictitious; passwords are throwaway.
// Writes .work/state.json (tokens) for record.mjs.
import {execFileSync} from 'node:child_process';
import {writeFileSync, mkdirSync} from 'node:fs';

const BASE = process.env.OC_URL || 'http://localhost:18080';
const PW = 'Docs-Screens-2026';
const dir = new URL('.', import.meta.url).pathname;

async function api(token, method, path, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: {'Content-Type': 'application/json', ...(token ? {Authorization: `Bearer ${token}`} : {})},
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok && !process.env.SEED_ALLOW_FAIL?.includes(path)) throw new Error(`${method} ${path} → ${res.status} ${text}`);
  try { return JSON.parse(text); } catch { return text; }
}
const list = (x) => (Array.isArray(x) ? x : x?.items ?? []);
const login = async (u, p) => (await api(null, 'POST', '/api/auth/login', {username: u, password: p})).token;

// 1. admin password
let admin;
try {
  admin = await login('admin', 'admin');
  await api(admin, 'POST', '/api/auth/change-password', {currentPassword: 'admin', newPassword: PW});
} catch { /* already changed */ }
admin = await login('admin', PW);

// 2. clusters: the same k3d cluster twice, as "prod-eu" and "staging"
const [tok, ca] = execFileSync(`${dir}cluster.sh`, ['token']).toString().trim().split('\n');
const clusters = list(await api(admin, 'GET', '/api/admin/clusters'));
const ids = {};
for (const name of ['prod-eu', 'staging']) {
  const found = clusters.find((c) => c.name === name);
  ids[name] = found ? found.id : (await api(admin, 'POST', '/api/admin/clusters', {
    name, description: name === 'prod-eu' ? 'Production, EU' : 'Staging', method: 'token',
    server: 'https://kubernetes.default.svc', token: tok, caCertBase64: ca,
  })).id;
}
await api(admin, 'POST', `/api/admin/clusters/${ids['prod-eu']}/activate`);

// 3. roles
const READ = ['list', 'get'];
const kinds = ['pods', 'deployments', 'daemonsets', 'statefulsets', 'hpas', 'services', 'configmaps', 'ingresses', 'cronjobs', 'jobs', 'secrets'];
const grants = (cluster, ns, extra) => [
  ...kinds.flatMap((r) => READ.map((a) => [cluster, ns, r, a])),
  ...extra.map(([r, a]) => [cluster, ns, r, a]),
];
const roles = {
  'shop-developer': {desc: 'Shop team: full work on staging, read + logs on prod', apiAccess: 'safe_read', grants: [
    ...grants(ids.staging, 'shop', [['pods', 'logs'], ['pods', 'exec'], ['deployments', 'restart'], ['deployments', 'scale'], ['statefulsets', 'scale'], ['deployments', 'edit'], ['configmaps', 'edit'], ['secrets', 'reveal']]),
    ...grants(ids['prod-eu'], 'shop', [['pods', 'logs']]),
  ]},
  'sre': {desc: 'Read, logs, restart and scale everywhere', apiAccess: 'full', grants: ['shop', 'payments', 'platform'].flatMap((ns) =>
    grants(0, ns, [['pods', 'logs'], ['pods', 'exec'], ['deployments', 'restart'], ['deployments', 'scale'], ['statefulsets', 'scale']]))},
  'payments-viewer': {desc: 'Read-only on payments', apiAccess: 'safe_read', grants: grants(ids['prod-eu'], 'payments', [])},
};
const existingRoles = await api(admin, 'GET', '/api/admin/roles');
const roleIds = {};
for (const [name, r] of Object.entries(roles)) {
  const found = list(existingRoles).find((x) => x.name === name);
  if (found) { roleIds[name] = found.id; continue; }
  roleIds[name] = (await api(admin, 'POST', '/api/admin/roles', {name, description: r.desc, apiAccess: r.apiAccess})).id;
  for (const [clusterId, namespace, resource, action] of r.grants) {
    await api(admin, 'POST', `/api/admin/roles/${roleIds[name]}/permissions`, {clusterId, namespace, resource, action});
  }
}

// 4. groups
const groups = {'shop-team': ['shop-developer'], 'sre': ['sre'], 'finance-readers': ['payments-viewer']};
const existingGroups = await api(admin, 'GET', '/api/admin/groups');
const groupIds = {};
for (const [name, rs] of Object.entries(groups)) {
  const found = list(existingGroups).find((g) => g.name === name);
  groupIds[name] = found ? found.id : (await api(admin, 'POST', '/api/admin/groups', {name})).id;
  await api(admin, 'PUT', `/api/admin/groups/${groupIds[name]}/roles`, {roleIds: rs.map((x) => roleIds[x])});
}

// 5. users
const users = {
  alice: {groups: ['shop-team'], isAdmin: false},
  bob: {groups: ['sre'], isAdmin: false},
  'ayse.yilmaz': {groups: ['finance-readers'], isAdmin: false},
  'ops.lead': {groups: [], isAdmin: true},
};
const existingUsers = list(await api(admin, 'GET', '/api/admin/users'));
for (const [username, u] of Object.entries(users)) {
  if (existingUsers.some((x) => x.username === username)) continue;
  await api(admin, 'POST', '/api/admin/users', {username, password: PW, isAdmin: u.isAdmin, source: 'local', groupIds: u.groups.map((g) => groupIds[g])});
}
const alice = await login('alice', PW);
const bob = await login('bob', PW);

// 6. alice: cluster, saved views, API keys
await api(alice, 'POST', '/api/cluster/select', {clusterId: ids.staging});
const views = await api(alice, 'GET', '/api/views');
if (!list(views).length) {
  await api(alice, 'POST', '/api/views', {name: 'Shop · failing pods', namespace: 'shop', tab: 'pods', search: 'catalog', viewMode: 'list', shared: false});
  await api(alice, 'POST', '/api/views', {name: 'Shop · web tier', namespace: 'shop', tab: 'pods', search: 'label:tier=web', viewMode: 'list', shared: true});
}
const keys = await api(alice, 'GET', '/api/me/api-keys');
if (!list(keys).length) {
  const in30 = new Date(Date.now() + 30 * 86400e3).toISOString();
  await api(alice, 'POST', '/api/me/api-keys', {name: 'claude-code', note: 'Triage in staging', expiresAt: in30, clusters: [ids.staging], allNamespaces: true, namespaces: [], grants: ['pods:list', 'pods:get', 'pods:logs', 'deployments:list', 'deployments:get']});
  await api(alice, 'POST', '/api/me/api-keys', {name: 'ci-smoke-test', note: 'Pipeline checks after deploy', expiresAt: in30, clusters: [ids.staging], allNamespaces: false, namespaces: ['shop'], grants: ['pods:list', 'deployments:list']});
}

// 7. activity for the audit log and recordings. A web session acts on the user's
// selected cluster (X-OpenConsole-Cluster is for API keys only).
const hdr = (t) => ({'Content-Type': 'application/json', Authorization: `Bearer ${t}`});
const select = (t, clusterId) => api(t, 'POST', '/api/cluster/select', {clusterId});
const pods = await (await fetch(BASE + '/api/namespaces/shop/pods', {headers: hdr(alice)})).json();
const web = list(pods).find((p) => p.metadata.name.startsWith('storefront-'));
if (web) {
  await fetch(BASE + `/api/namespaces/shop/pods/${web.metadata.name}/exec`, {method: 'POST', headers: hdr(alice),
    body: JSON.stringify({container: 'storefront', command: ['ls', '/'], timeoutSeconds: 20})});
  await fetch(BASE + `/api/namespaces/shop/pods/${web.metadata.name}/logs?tailLines=50`, {headers: hdr(alice)});
}
await select(alice, ids['prod-eu']);
await fetch(BASE + '/api/namespaces/shop/deployments/storefront/restart', {method: 'POST', headers: hdr(alice)}); // denied: read-only on prod
await select(alice, ids.staging);
await select(bob, ids['prod-eu']);
await fetch(BASE + '/api/namespaces/shop/deployments/catalog/restart', {method: 'POST', headers: hdr(bob)});
await fetch(BASE + '/api/namespaces/payments/deployments/payments-api/scale', {method: 'POST', headers: hdr(bob), body: JSON.stringify({replicas: 3})});
await fetch(BASE + '/api/namespaces/payments/deployments/payments-api/scale', {method: 'POST', headers: hdr(bob), body: JSON.stringify({replicas: 2})});

mkdirSync(`${dir}.work`, {recursive: true});
writeFileSync(`${dir}.work/state.json`, JSON.stringify({base: BASE, password: PW, clusters: ids,
  tokens: {admin, alice, bob, ayse: await login('ayse.yilmaz', PW)}}, null, 2));
console.log('seeded', ids);
