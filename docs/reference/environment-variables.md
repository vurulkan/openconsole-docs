---
title: "Environment variables"
description: "Every environment variable and its default."
---

# Environment variables

## Core
- `DATA_PATH` (default `/data/app.db` in the image) — SQLite DB location. Must be on a persistent volume.
- `STATIC_DIR` (default `/app/public` in the image) — Served React build output.
- `TIMEZONE` (default `UTC`) — Used for audit log timestamps.
- `LOG_RETENTION_DAYS` (default `30`) — Audit log retention (purged automatically).
- `API_KEY_READ_RETENTION_DAYS` (default `7`) — How long **successful reads made with an API key** (`list`, `get`, `logs`, `view_yaml`, `view_overview`) are kept; they are most of an agent's audit volume. Writes, denials, failures, `pod.exec` and `api_key.*` events stay for `LOG_RETENTION_DAYS`. The console / Elastic lines are not affected. See [API keys](/api/api-keys).
- `RESTART_HISTORY_RETENTION_DAYS` (default `30`) — How long container exits (restart history) are kept.
- `MAX_REPLICAS` (default `100`) — Hard upper bound the Scale endpoint accepts for Deployment / StatefulSet scaling.

## Session recording
You normally set none of these. Recording is configured in **Admin → Recordings → Recording settings** and stored in the DB. The env vars below only **seed** those settings on the very first start, which is useful for scripted installs; after that, changing them has no effect. The exception is `SESSION_RECORDING_DIR`, which is read on every start and is the only one `deploy/deployment.yaml` mentions. See [Session Recording](/administration/recordings).

- `SESSION_RECORDING_ENABLED` (default `true`) — record new pod shell sessions.
- `SESSION_RECORDING_DIR` (default `<dir of DATA_PATH>/recordings`, i.e. `/data/recordings`) — where `.cast` files are written.
- `SESSION_RECORDING_RETENTION_DAYS` (default `30`, `0` = never purge) — daily purge of older recordings.
- `SESSION_RECORDING_MAX_SIZE_MB` (default `10`) — per-session cap; past it the recording stops and is flagged truncated.
- `SESSION_RECORDING_MAX_TOTAL_MB` (default `2048`) — quota for all recordings together.
- `SESSION_RECORDING_MIN_FREE_MB` (default `512`) — free space always left on the recordings volume.
- `SESSION_RECORDING_DISK_POLICY` (default `evict_oldest`) — `evict_oldest` or `stop`; see below.

## Security & limits
- `PASSWORD_MIN_LENGTH` (default `8`) — minimum length of local passwords (create, change, admin reset). Passwords are also capped at 72 bytes (bcrypt), must not be blank, and a change must actually change the password.
- `EXEC_IDLE_TIMEOUT` (default `5m`, minimum `30s`) — a pod shell with no input for this long is closed. Go duration syntax: `90s`, `10m`, `1h`.
- `MAX_EXEC_SESSIONS_PER_USER` (default `3`, `0` = unlimited) — concurrent pod shells per user; one more is refused with 429 and audited as `pod.exec` with outcome `rate_limited`.

## Feature flags
Switch a capability off **for everyone, admins included**, regardless of role permissions — for example to keep pod shells closed in production for a while. Set `FEATURE_<NAME>=false` (or `0` / `no`); anything else, or unset, leaves it on.

| Variable | Turns off |
|---|---|
| `FEATURE_POD_EXEC` | pod shell (`pods:exec`) |
| `FEATURE_YAML_EDIT` | YAML edit / apply on every resource except Secrets (`{resource}:edit`) |
| `FEATURE_WORKLOAD_ACTIONS` | deployment restart / scale, statefulset scale |
| `FEATURE_SECRETS` | the whole Secrets tab (every `secrets:*`) |
| `FEATURE_SECRET_REVEAL` | revealing secret values (`secrets:reveal`) |
| `FEATURE_SECRET_EDIT` | editing secrets (`secrets:edit`) |
| `FEATURE_API_KEYS` | API keys: the page, the `/api/me/api-keys` endpoints and signing in with a key (a key then gets 401) |

A disabled feature disappears from the UI and every endpoint for it answers 403 *"this feature is disabled by the operator"* and writes the usual `denied` audit entry. `GET /api/features` shows the current state; the startup log lists what is off.
