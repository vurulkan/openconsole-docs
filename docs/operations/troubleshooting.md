---
title: "Troubleshooting"
description: "Find your symptom by the message OpenConsole shows or logs, and what to do about it. Includes every 403 reason."
---

# Troubleshooting

Search this page for the message you see. Messages in `code` are exactly what OpenConsole 2.22.0 shows, answers or
logs. The log lines are in `kubectl -n kubernetes-openconsole logs deploy/kubernetes-openconsole`
([Logging](/operations/logging)).

## Adding a cluster fails

**Save Cluster** answers `cluster validation failed: cannot list namespaces with these credentials: …`. The end of
the message says why:

| Message ends with | Cause | Fix |
|---|---|---|
| `context deadline exceeded` | the API server address doesn't answer from the OpenConsole pod (wrong address, firewall, private endpoint) | test from the pod's network; for the cluster OpenConsole runs in, use `https://kubernetes.default.svc` |
| `dial tcp: lookup <host> on …: no such host` | the host name doesn't resolve inside the cluster | use a name or IP the pod can resolve |
| `tls: failed to verify certificate: x509: certificate signed by unknown authority` | the CA certificate is missing or wrong | paste the cluster's CA (base64) ([Connect a cluster](/installation/connect-cluster#2-read-the-token-and-ca)) |
| `Unauthorized` | the token is wrong, expired, or its ServiceAccount was deleted | read the token again |
| `namespaces is forbidden: User "system:serviceaccount:…" cannot list resource "namespaces" …` | the identity has no ClusterRole binding (or not this one) | apply `deploy/rbac.yaml` and bind it to that identity |

## A cluster shows empty lists or 503

The cluster was added fine, but now its workload lists are empty, other screens fail, and the log is full of:

```text
…/reflector.go:229: Failed to watch *v1.Pod: failed to list *v1.Pod: Unauthorized
…/reflector.go:229: Failed to watch *v1.Job: failed to list *v1.Job: jobs.batch is forbidden: User "system:serviceaccount:default:temp" cannot list resource "jobs" in API group "batch" at the cluster scope
```

and requests answer `503`, `{"error":"Unauthorized"}`, or
`{"error":"the OpenConsole ServiceAccount is not allowed to read secrets here (check the ClusterRole)"}`.

The credentials OpenConsole holds for that cluster stopped working: the token was rotated or its ServiceAccount
deleted (`Unauthorized`), or the ClusterRole or its binding changed (`forbidden`). The cluster's connection gauge
still reads `1` ([Metrics](/operations/metrics#what-to-watch)). Fix the identity, then in **Admin → Clusters → Edit**
tick **Replace credentials** and paste the token and the CA ([Rotate the token](/installation/connect-cluster#rotate-the-token)).
The cluster works again at once; no restart is needed.

`{"error":"the OpenConsole ServiceAccount is not allowed to read <resource> here (check the ClusterRole)"}` alone,
for one kind of resource, means only that rule is missing ([Kubernetes permissions](/reference/kubernetes-permissions)).
A write the ClusterRole doesn't allow answers 403 with the API server's message, e.g.
`restart failed: deployments.apps "web" is forbidden: …` (a view-only ClusterRole, or the `patch` / `update` verb
removed).

## No CPU or memory figures

| Message | Cause |
|---|---|
| `metrics-server was not found on this cluster; CPU and memory usage are not shown.` | install metrics-server (`kubectl get apiservices v1beta1.metrics.k8s.io` should say `True`) |
| `The OpenConsole ServiceAccount may not read metrics.k8s.io pods (check the ClusterRole).` | add the `metrics.k8s.io` rule of `deploy/rbac.yaml` |
| `Pod metrics could not be read from this cluster.` | metrics-server answered with an error; see its own log |
| `Prometheus is unreachable; showing the last 24 hours from memory` | the cluster's Prometheus setting doesn't answer; use **Test connection** below |
| `No samples yet; the first arrive within 30 seconds.` | OpenConsole just started or the cluster was just connected; wait |

## Prometheus "Test connection" fails

Admin → Clusters → Prometheus → **Test connection** stops at the first failing step and says why:

| Message | Fix |
|---|---|
| `The settings are incomplete or invalid.` | fill in namespace, Service and port, or a URL starting with `http(s)://` |
| `The OpenConsole ServiceAccount may not use services/proxy on this Service; add the rule from deploy/rbac.yaml.` | uncomment the `services/proxy` rule, with your Prometheus Service in `resourceNames` |
| `The Service or its port was not found, or it has no ready endpoints.` | check the namespace, Service name and port (**Find** lists candidates) |
| `Prometheus refused the credentials (401 / 403).` | check the user / password, token, or client certificate |
| `The address answered, but not with the Prometheus API. Check the URL / port and the path prefix.` | point at the Prometheus HTTP API, including a path prefix if it has one |
| `The host name could not be resolved.` | the URL's host doesn't resolve from the OpenConsole pod |
| `TLS failed: check the CA certificate, or skip verification for a test.` | add the CA certificate |
| `No answer in time.` / `The address could not be reached.` | firewall, NetworkPolicy, wrong port |
| `Connected, but there are no container metrics for this cluster: cAdvisor may not be scraped, or the cluster filter is wrong.` | scrape the kubelet's cAdvisor endpoint, or fix the cluster label value |
| `This Prometheus holds several clusters (…); pick the value for this one, or the charts add them up.` | set the cluster label and this cluster's value |

More: [Prometheus](/administration/prometheus).

## Sign-in fails

| Symptom | Where to look |
|---|---|
| `Login failed. Please check your credentials.` | Admin → Audit Logs, action `user.login`, outcome `failed`. The reason says which: `bad_password` (wrong password; also an LDAP account whose directory bind failed), `unknown_user` (no such account, or deactivated), `azure_account` (an Azure AD account typed a password: use **Sign in with Microsoft**) |
| the same message after 5 tries, and `429` with `Retry-After` from `/api/auth/login` | that user name is locked for 5 minutes from that address, audited as `user.login` `locked` (`too_many_failures`). Wait, or sign in from another machine |
| `Your session has ended. Please sign in again.` | the session expired (Admin → Sessions sets the lifetime) or an admin revoked it |

The audit reason doesn't say why an LDAP bind failed. Test the directory from **Admin → LDAP → Test connection**,
which answers with the directory client's message, for example:

```text
LDAP Result Code 200 "Network Error": dial tcp 127.0.0.1:389: connect: connection refused
LDAP Result Code 200 "Network Error": dial tcp: lookup ldap.example.invalid on 10.43.0.10:53: no such host
```

`connection refused` / `no such host` are the host and port; `Invalid Credentials` is the bind DN or password; a
certificate error is the TLS settings.

## Shells or live logs break behind a proxy

| Symptom | Cause | Fix |
|---|---|---|
| the shell says `Connection error.` or `Session closed (1006).` at once; the log has `GET /ws/namespaces/…/exec 400`, the answer is `{"error":"a WebSocket upgrade is required"}` | the proxy drops the `Upgrade` / `Connection` headers | pass WebSockets through (ingress-nginx, Traefik and the Gateway API do by default; a hand-written nginx needs `proxy_http_version 1.1` and both headers) |
| a quiet shell closes after about a minute with `Session closed (1006).`; a quiet log stream shows `Connection dropped; reconnecting…` | the proxy's idle timeout | raise it above `EXEC_IDLE_TIMEOUT` (5 minutes) ([Ingress with TLS](/installation/kubernetes#ingress-with-tls)) |
| `You already have 3 shells open, the most allowed. Close one and try again.` | `MAX_EXEC_SESSIONS_PER_USER` (3) open shells; audited `pod.exec` `rate_limited` (`max_sessions`) | close one, or raise the limit |
| `Too many log streams; try again shortly.` | the per-user log stream limit | close log viewers you don't need |
| a WebSocket answers `401` | its ticket was used already or is older than 30 seconds | the UI gets a new ticket for every connection; a script must too (`POST /api/ws-ticket`) |

## Error answers

Every error answer is JSON, `{"error": "<reason or message>"}`. `401` has no body: the session or API key is
missing, expired or revoked.

### 403 reasons

| `error` | Meaning | Source (v2.22.0) |
|---|---|---|
| `forbidden` | no permission for this action here (namespace, cluster) | [audit_events.go#L91](https://github.com/vurulkan/kubernetes-openconsole/blob/v2.22.0/backend/internal/api/audit_events.go#L91), [router.go#L2642-L2651](https://github.com/vurulkan/kubernetes-openconsole/blob/v2.22.0/backend/internal/api/router.go#L2642-L2651) |
| `api_access_policy` | with an API key: the owner has the permission and the key lists it, but the admin's API access policy keeps it from keys | [audit_events.go#L95-L97](https://github.com/vurulkan/kubernetes-openconsole/blob/v2.22.0/backend/internal/api/audit_events.go#L95-L97), [router.go#L2612-L2629](https://github.com/vurulkan/kubernetes-openconsole/blob/v2.22.0/backend/internal/api/router.go#L2612-L2629) |
| `api_access_off` | with an API key: the policy turns API access off for this user | [audit_events.go#L98-L99](https://github.com/vurulkan/kubernetes-openconsole/blob/v2.22.0/backend/internal/api/audit_events.go#L98-L99), [apikeys.go#L205-L208](https://github.com/vurulkan/kubernetes-openconsole/blob/v2.22.0/backend/internal/api/apikeys.go#L205-L208) |
| `api_key_not_allowed` | an API key may never do this (manage keys, change the password, pick the cluster, save views) | [apikeys.go#L51](https://github.com/vurulkan/kubernetes-openconsole/blob/v2.22.0/backend/internal/api/apikeys.go#L51), [apikeys.go#L244-L252](https://github.com/vurulkan/kubernetes-openconsole/blob/v2.22.0/backend/internal/api/apikeys.go#L244-L252) |
| `feature_disabled` | the operator switched the capability off (`FEATURE_*=false`) | [audit_events.go#L92](https://github.com/vurulkan/kubernetes-openconsole/blob/v2.22.0/backend/internal/api/audit_events.go#L92), [router.go#L2637-L2640](https://github.com/vurulkan/kubernetes-openconsole/blob/v2.22.0/backend/internal/api/router.go#L2637-L2640) |
| `admin_only` | an admin screen or endpoint; with an API key, one without the Admin API scope | [audit_events.go#L93](https://github.com/vurulkan/kubernetes-openconsole/blob/v2.22.0/backend/internal/api/audit_events.go#L93), [router.go#L598-L605](https://github.com/vurulkan/kubernetes-openconsole/blob/v2.22.0/backend/internal/api/router.go#L598-L605) |
| `change your password first` | an API key, or the API keys page, of an account that still has to change its initial password (on other screens such an account gets `forbidden`) | [apikeys.go#L196-L199](https://github.com/vurulkan/kubernetes-openconsole/blob/v2.22.0/backend/internal/api/apikeys.go#L196-L199), [apikeys.go#L431-L432](https://github.com/vurulkan/kubernetes-openconsole/blob/v2.22.0/backend/internal/api/apikeys.go#L431-L432) |
| `you have no permissions on this cluster` | picking a cluster none of your grants cover | [cluster_ctx.go#L172](https://github.com/vurulkan/kubernetes-openconsole/blob/v2.22.0/backend/internal/api/cluster_ctx.go#L172) |
| `only the owner can change this view` | editing someone else's shared view | [views.go#L161](https://github.com/vurulkan/kubernetes-openconsole/blob/v2.22.0/backend/internal/api/views.go#L161) |
| `user is disabled` | an Azure AD sign-in for a deactivated account | [router.go#L989-L991](https://github.com/vurulkan/kubernetes-openconsole/blob/v2.22.0/backend/internal/api/router.go#L989-L991) |
| `the OpenConsole ServiceAccount is not allowed to read <resource> here (check the ClusterRole)` | Kubernetes refused OpenConsole's identity, not you | [secrets.go#L227-L229](https://github.com/vurulkan/kubernetes-openconsole/blob/v2.22.0/backend/internal/api/secrets.go#L227-L229) |
| `restart failed: …` / `scale failed: …` / the API server's message | Kubernetes refused a write (ClusterRole without that verb) | [deployment_actions.go#L160-L164](https://github.com/vurulkan/kubernetes-openconsole/blob/v2.22.0/backend/internal/api/deployment_actions.go#L160-L164), [yaml_apply.go#L111](https://github.com/vurulkan/kubernetes-openconsole/blob/v2.22.0/backend/internal/api/yaml_apply.go#L111) |

The first six are also the `reason` of the `denied` audit event. For API keys and agents, see also
[API overview](/api/overview).

### Other answers

| Answer | Meaning |
|---|---|
| `400` `cluster "<name>" is unknown or not reachable with this key` | the `X-OpenConsole-Cluster` header names a cluster that doesn't exist or the key doesn't cover |
| `429` (no body) with an API key | more than 10 requests per second (bursts of 30) for that key |
| `429` `too many open shells (limit 3 per user); close one first` | the shell limit, from a client that isn't a browser |
| `503` from `/readyz`: `db not reachable` | the database file can't be opened: check the volume ([Health probes](/operations/health-probes)) |
