---
title: "Tips and gotchas"
description: "Things that commonly trip people up."
---

# Tips and gotchas

- **Cluster connection is UI-only**. No env vars, mounted kubeconfigs or in-cluster ServiceAccount auto-detection are used by the backend: add even the local cluster in Admin → Clusters.
- **Namespace visibility is permission-based**; if a user sees nothing, check role permissions.
- If LDAP bind password is already configured, toggle **Update Bind Password** only when actually changing it.
- Audit log filters combine user / action / outcome / namespace / date range.
- Pod logs stream via WebSocket; verify connectivity from the backend pod to the API server.
- WebSockets (logs, shell, live events) sign in with a single-use ticket: the page calls `POST /api/ws-ticket` `{"path"}` and opens `/ws/…?ticket=<t>`. A ticket works once, for that path, within 30 s; the JWT never appears in a URL, so proxy access logs can't leak it. `?token=` is no longer accepted.
- The YAML modal is read-only by default — the Edit button only appears when the viewer has `{resource}:edit`.
- Monaco loads from `cdn.jsdelivr.net`. In air-gapped deployments, self-host the `vs` folder and point `@monaco-editor/react`'s `loader.config({ paths: { vs: '/vs' } })` at the local path, then tighten CSP back to `self`.
