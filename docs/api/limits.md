---
title: "Limits"
description: "Rate limits, log and command size and time limits, truncation, WebSocket tickets."
---

# Limits

What OpenConsole refuses or cuts, so a script or an agent can handle it. Every refusal below is audited with outcome
`rate_limited` (or `denied` / `failed`).

## Requests

| Limit | Applies to | Over it |
|---|---|---|
| 10 requests a second, bursts of 30 | each API key, every call | 429 with an empty body and no `Retry-After`; wait a second. Audited as `api_key.use` / `rate_limited`, at most once a minute per key. |
| 5 at once, then one every 6 seconds | Deployment restart and scale, StatefulSet scale, YAML apply (not the dry run); per user, keys and web together | 429 `{"error":"rate limited"}`; YAML apply also sends `Retry-After: 6`. |
| 10 at once, then one a second | Log reads and log streams; per user | 429 `{"error":"rate_limited"}` (a stream gets an `error` frame with `retry: true`). |
| `MAX_EXEC_SESSIONS_PER_USER` open shells (default 3) | Shells and one-command exec; per user, keys and web together | 429 `{"error":"too_many_sessions"}` for a command; a shell is refused with *too many open shells*. |
| `MAX_REPLICAS` (default 100) | Scale | 400 `replicas must be between 0 and 100`. |

Both variables are on [Environment variables](/reference/environment-variables).

## Reading a log: `GET …/pods/{name}/logs`

| Parameter | Default | Limit |
|---|---|---|
| `tailLines` | 500 | 1 to 10 000; outside → 400 `tailLines must be between 1 and 10000` |
| `sinceSeconds` | none | a positive number |
| `previous`, `timestamps`, `container` | `false`, `false`, the main container | |

The answer is plain text of at most **5 MiB**. A longer log is cut at a line end and the response carries
`X-OpenConsole-Truncated: true`: ask for fewer lines or a shorter `sinceSeconds`.

## Running a command: `POST …/pods/{name}/exec`

| | |
|---|---|
| `command` | An argv array, not run in a shell: `["sh", "-c", "ps aux \| head"]` for pipes. No stdin. |
| `timeoutSeconds` | 1 to 120, default 30. |
| Output | `stdout` and `stderr`, **1 MiB each**; past that the rest is dropped and `truncated` is `true`, while the command runs to its end. |
| Timeout | What was printed so far, `exitCode: -1`, `truncated: true`. Kubernetes doesn't stop the process; it may go on running in the container. |
| Exit code | A non-zero exit code is a 200 with that `exitCode`. |
| Text | Output is text: bytes that aren't UTF-8 become `�`; pipe through `base64` for binary. |

A command run with a key is always recorded; the audit event keeps the program (`command[0]`), the exit code, bytes,
duration and the recording id, never the arguments.

## WebSockets

Live logs, shells and the event stream are WebSockets. A key is never accepted in a URL, so:

1. `POST /api/ws-ticket` with the key and `{"path": "/ws/namespaces/<ns>/pods/<pod>/logs"}` (the socket's path);
   the answer is `{"ticket": "…"}`.
2. Open the socket at that path with `?ticket=<ticket>` within **30 seconds**. A ticket works once, for that path
   only.

```bash
curl -s -H "Authorization: Bearer $OPENCONSOLE_API_KEY" -H "Content-Type: application/json" \
  -d '{"path": "/ws/namespaces/crashlab/pods/healthy-66fb4fb769-4cjqs/logs"}' "$OC_URL/api/ws-ticket"
```

```json
{"ticket":"89240df50d12c7a283c0607e0b38a0c95dff80d1d482714b"}
```

For an agent the plain HTTP endpoints above are simpler: a log snapshot and one command need no socket.

A shell closes after `EXEC_IDLE_TIMEOUT` without input (default 5 minutes).
