---
title: "Pod shell"
description: "Interactive shell into a container, limits and audit."
---

# Pod shell

Interactive shell into a running container, gated by application permission `pods:exec`. Off by default on every role; admins opt in per role, per namespace.

- Endpoint: `GET /ws/namespaces/{namespace}/pods/{name}/exec?container=<c>&command=/bin/sh` (WebSocket).
- xterm.js UI with a shell picker (`/bin/sh`, `/bin/bash`, `/bin/ash`). For a pod with several containers the Shell button first opens a small menu: the main container on top and focused (the `kubectl.kubernetes.io/default-container` annotation, else the one named after the workload, so a sidecar listed first is not the default; Enter opens it), containers that are not running greyed out. The terminal can still switch container.
- Idle timeout: **5 minutes** without input closes the session (`EXEC_IDLE_TIMEOUT`).
- At most **3** open shells per user (`MAX_EXEC_SESSIONS_PER_USER`); the next one is refused with 429 and audited as `pod.exec.rate_limited`.
- For one command without a terminal (scripts, agents): `POST /api/namespaces/{namespace}/pods/{name}/exec`, see [API and agents](/api/api-keys).
- Each session writes two `pod.exec` audit events, `phase: start` (container, command) and `phase: end`. The end event carries `exit_code` (the shell's exit status; `-1` when the session was cut — idle timeout, closed tab, network), `bytes_in`, `bytes_out` and `duration_ms`. A shell that ends with a non-zero status, e.g. after a failed last command, is a normal end (outcome `success`).
- Can be switched off for everyone with `FEATURE_POD_EXEC=false` ([Feature flags](/reference/environment-variables#feature-flags)).
- Terminal output is recorded by default — see [Session Recording](/administration/recordings).
- ClusterRole must grant `pods/exec: create` for this to work.

**Security notes**
- Exec is the highest-risk action in OpenConsole; grant it narrowly.
- Non-root pod admission policies in your cluster still apply.
