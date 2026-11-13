---
title: "Introduction"
description: "What Kubernetes OpenConsole is, what it does and how it is built."
---

# Introduction

Modern, production-ready Kubernetes visibility and operations console with strict application-level authorization. Runs inside Kubernetes, reads cluster data using a single ServiceAccount identity per cluster, and enforces every access decision in the app layer (not via Kubernetes RBAC). Scripts and AI agents use the same rules through a documented REST API with scoped API keys.

## Highlights

### Observability & live data
- **Admin overview** (`/overview`, admins only; admins land here after sign-in) — the selected cluster at a glance: pods running, pods needing attention (red / amber), restarts in 24 h, ready Deployments, CPU and memory as % of allocatable (each with a 24 h trend), cluster usage over 24 h against allocatable (Prometheus when configured, else the in-memory samples), the pods needing attention, the workloads restarting most with their usual exit code, restarts per hour, the busiest namespaces (pods near their limits), Warning events of the last 15 minutes and a node strip (a node opens its drawer on Nodes; "All nodes" opens the list). `GET /api/admin/overview` (cached 15 s per cluster) draws the page without waiting for Prometheus; the 24 h usage comes from `GET /api/admin/overview/history` (a Prometheus answer is kept 5 minutes and refreshed in the background). Opening the page is audited as `cluster.view_overview`, its own refreshes are not. Needs `nodes` and `metrics.k8s.io` `nodes` in the ClusterRole for the node data.
- **Nodes** (`/nodes`, admins only, read only; rail item under Overview, `g n`, command palette; `/nodes?node=<name>` opens a node, as the overview strip and the node name in a pod drawer do) — every node of the selected cluster: status (Ready / NotReady / pressure, cordoned), roles, kubelet version, OS / architecture, age, pods against capacity, and CPU / memory used, requested and limited as % of allocatable. `GET /api/admin/nodes` (cached 15 s per cluster), `GET /api/admin/nodes/{name}` (the node, its pods with requests and usage, its events; from the informer cache, pods by a `spec.nodeName` index), `GET /api/admin/nodes/{name}/metrics/history?range=` (Prometheus: the node's containers by the `node` or `instance` label, else its pods summed; without Prometheus, the in-memory samples of its pods). Click a node (or `j` / `k` and Enter) for its drawer: summary (OS image, kernel, runtime, IPs, cordoned), capacity / allocatable / requests / limits / used for CPU, memory, pods and ephemeral storage, usage history (1 h / 6 h / 24 h, 7 d with Prometheus), its top pods by CPU or memory, every pod on it (all or only those needing attention; a pod opens on the Dashboard), conditions, taints, labels, annotations and events. Search matches the name, a role or a label (`key=value`). Audited as `node.list` / `node.get` (ECS `event.type: access`); a non-admin gets 403 and a `denied` event; the page's refreshes are not audited.
- **Informer-driven lister cache** — list endpoints read from a `client-go` SharedInformerFactory, so the UI is instant and the API server isn't hammered by polling.
- **Live Events side panel** (header button or `e`, on the Dashboard and the Overview) — streams `added` / `updated` / `deleted` plus native `corev1.Event` objects (new ones and each repeat of a recurring one) over a WebSocket. Filter by All / K8s events / Warnings. A user sees only objects they may `list` in that namespace (Kubernetes Events by the object they are about); node and other cluster-scoped events are for admins. On Admin → Overview the panel opens for the whole cluster, on Warnings.
- **Prometheus `/metrics`**, dedicated `/livez` (process) and `/readyz` (DB) endpoints. Clusters are left out of readiness, so one unreachable cluster can't take the console down. See [Metrics](/operations/metrics).
- **Pod health like `kubectl`, and why it restarted** — the STATUS `kubectl get pods` prints (CrashLoopBackOff, OOMKilled, ImagePullBackOff, Init:Error, Unschedulable …) in red / amber / green, and the last exit of a restarted container (`137 OOMKilled · 2m`) with a plain-language explanation; the log of the container before its last restart. See [Pod health, usage and restart history](/user-guide/pod-health).
- **Detail drawers** for pods, Deployments, StatefulSets and DaemonSets — containers, requests / limits, probes, conditions, events; rollout, the workload's pods, usage, restart history, and a Deployment's revisions (read only). Workload lists flag workloads whose pods are failing.
- **CPU / memory** from metrics-server against the limit, with 1h – 24h charts kept in memory, or up to 7 days from the cluster's **Prometheus** (in the cluster through the API server proxy, or any Prometheus-compatible URL).
- **Restart history** — every container exit OpenConsole sees is kept for 30 days, also for pods that no longer exist.
- **OpenTelemetry tracing** (opt-in): one span per API request, named after its route, with the Kubernetes API calls it made as child spans. Exported over OTLP/HTTP to any collector (Jaeger, Tempo, Elastic APM, …). See [Tracing](/operations/tracing).

### Workloads shown in the Dashboard
Pods, Deployments, **DaemonSets**, **StatefulSets**, **HorizontalPodAutoscalers (v2)**, Services, ConfigMaps, **Secrets**, Ingresses, CronJobs, Jobs — card view, list view, label filters, saved views.

### Write operations (opt-in per role, per namespace)
- **Deployment restart** (`deployments:restart`)
- **Deployment / StatefulSet scale** (`deployments:scale`, `statefulsets:scale`)
- **YAML view + edit + server dry-run + apply** for every workload above (`{resource}:edit`), powered by Monaco. Diff view, dry-run returns the server-canonicalized object, optimistic concurrency via `resourceVersion`.
- **Pod shell** (`pods:exec`) over WebSocket with xterm.js, and one command over REST for scripts and agents (`POST …/pods/{name}/exec`).
- **Pod shell session recording** — every shell and every single command is saved as an asciicast v2 file and can be replayed by admins (Admin → Recordings) with an in-browser player. See [Session Recording](/administration/recordings).
- **Secrets** (`secrets:list`, `secrets:get`, `secrets:reveal`, `secrets:edit`) — names, types and key names by default; values are revealed one key at a time, and secrets can be edited in the YAML editor (diff + dry-run). Every reveal and every YAML open is audited. See [Secrets](/user-guide/secrets).
- **Pod / Deployment / Job logs** (`pods:logs`): container picker (init containers included; opens on the `kubectl.kubernetes.io/default-container` annotation, else the container named after the workload, so a sidecar listed first is not the default), live or the instance before the last restart, follows a restarting container and resumes after a dropped connection without losing or repeating lines; find, pause, wrap, copy, download; keeps the last 10,000 lines. Per user: 10 new log streams at once, then one per second.

Every read and write is an audit event with its own fields: `action` (`deployment.restart`), `verb`, `outcome` (`success` / `denied` / `failed` / `rate_limited` / `locked`), the target cluster, namespace and resource, details such as `restarted_at` or `replicas_from` / `replicas_to`, and who / from where. See [Audit events](/reference/audit-events). The HTTP response carries `X-Request-Id` for correlation with the audit line in stdout.

### Access & identity
- **User → Groups → Roles → per-cluster, per-namespace permissions** (application-level RBAC, no Kubernetes RBAC for end users).
- **Namespace discovery is permission-based** (no leakage of names you can't access).
- **Multi-cluster, per user**: save N clusters. Every user picks their **own** cluster in the header (or with `c`), and admins set a default for everyone else. Permissions can be scoped per cluster, and audit records the cluster.
- **Local users** (bcrypt) + **LDAP** (bind-based, searchable + importable) + **Azure AD** single-tenant login — all configurable via UI.
- **JWT authentication** with forced password change on first login.
- **Session management** (Admin → Sessions): list every active token, revoke individual sessions or every session for a user, change-password revokes everything.
- **Session recordings** (Admin → Recordings): filter, replay (1x / 2x / 4x, seek, skip idle), download `.cast`, delete; retention, quota and on/off switch editable in the UI.
- **Login brute-force protection** (5 fails per IP+user → 5-minute lock, audited). Every sign-in is audited as `user.login` with the outcome (`success` / `failed` / `locked`), the method (`login_method`: `local` / `ldap` / `azure`) and, for a failure, the reason.

### API & AI agents
- **API keys** (account menu → API keys) for Claude Code, Cursor or your own scripts: `oc_…` keys limited to chosen clusters, namespaces and a permission matrix, never more than their owner holds at the time of the call; expiry, regenerate, revoke. The key is shown once and stored as a SHA-256 hash. Every action and resource read is audited with the user **and the key's name**; shells and commands run with a key are always recorded.
- **Admin policy** — per role, how much of it a key may get (Off / Safe read-only / All of the role's permissions), a per-user override, an expiry policy (longest lifetime, no-expiry allowed or not), and Admin → API keys: every user's keys, revoke with a reason, CSV.
- **OpenAPI 3.1** at `/api/openapi.json` (no sign-in) and an in-app **Documentation** tab: quick start, a text to hand your agent, every endpoint with its permission and a `curl` example, greyed out where your keys can't reach it.
- **No WebSocket needed** — a pod's log as text (`GET …/pods/{name}/logs`) and one command with its output and exit code (`POST …/pods/{name}/exec`; the audit log keeps the program name, never the command line).

See [API and agents](/api/api-keys).

### UX
- **Light / Dark / System theme** (persisted; respects OS).
- **Internationalization — English & Turkish** (locale switcher next to the theme toggle; defaults to browser language, persists user override). TR covers nav, Dashboard, Admin, audit, keyboard cheat sheet.
- **Keyboard-first navigation**: `⌘K` / `Ctrl+K` command palette, `?` cheat sheet, chord shortcuts for nav/theme, `c` cluster switcher, `v` saved views, `e` live events panel, `n` namespace filter focus. TR keyboard positions (`ğ` / `ü` / `.`) are mapped to the US `[` / `]` / `/` by physical key, so the shortcuts don't break on a TR Q layout.
- **Saved views** — store (cluster, namespace, tab, search, view mode) under a name on the server, so they follow you to any browser; **share** a view with every user.
- **Keyboard table navigation** — `j` / `k` move through rows of the admin tables, `Enter` opens, `d` deletes (with confirmation), `n` / `p` change page.
- **Search every column, plus label filters** — plain terms match the name and any column's text, `label:app=foo`, `label:tier`, AND-combined.
- **Audit logs** with pagination, filters, CSV export; **users and groups CSV export** for access reviews.
- **Accessible**: WCAG 2.1 AA contrast in light and dark themes, labelled controls, focusable scroll regions — checked with axe in the test suite and in a real browser.
- **Admin Role Permissions redesign** — role sidebar, grouped grant cards (namespaces that share identical grants merge), bulk Add Permissions modal with templates (Viewer / Developer / SRE / Admin), copy-from-role, inline edit.


## Architecture

- **Backend**: Go + `client-go` + chi router + slog + sqlite (modernc.org/sqlite).
- **Frontend**: React 18 + TypeScript + Vite + Tailwind + Monaco (lazy, CDN) + react-i18next + xterm.js + asciinema-player (lazy, bundled — no CDN).
- **Deployment**: single-container Docker image; Kubernetes manifests in `deploy/`.

Kubernetes OpenConsole is designed as an internal visibility and operations platform and is **not** a Kubernetes security boundary.

See [the missing page](/installation/does-not-exist).
