---
title: "Logging"
description: "What OpenConsole writes to stdout, in which format, and how a request and its audit event are linked."
---

# Logging

OpenConsole writes its log to stdout, one record per line. There is no log file and nothing to rotate: your
container runtime keeps the lines and your log shipper reads them. Four kinds of record come out:

| Record | `message` (`ecs`) | When |
|---|---|---|
| HTTP request | `GET /api/namespaces/{…}/pods 200` | every request, when it ends |
| Audit event | `alice: deployment.scale success shop/web on prod-eu` | every audited action, when `LOG_INCLUDE_AUDIT=true` (the default) |
| Kubernetes client | `…/reflector.go:229: failed to list *v1.Pod: Unauthorized` | client-go's own messages (watch errors, retries) |
| Application | `starting openconsole`, `cluster connected`, `session recording ready`, … | start-up, cluster connections, recordings, background jobs |

To send the lines to Elasticsearch with parsed fields and their own data streams, see [Elastic](/operations/elastic).

## Format

`LOG_FORMAT` picks one of three formats. The manifest in `deploy/` sets `ecs`; the built-in default is `text`.

| `LOG_FORMAT` | Use it for |
|---|---|
| `ecs` | Elastic: nested JSON in [Elastic Common Schema](https://www.elastic.co/guide/en/ecs/current/index.html) field names, `event.*` filled in |
| `json` | Loki, Vector, your own parsing: flat JSON with short names (`time`, `level`, `msg`, `user`, …) |
| `text` | reading `kubectl logs` by eye |

The same failed sign-in in each format, as 2.22.0 prints it (one line each; the `ecs` lines are wrapped here):

```text title="LOG_FORMAT=text"
time=2026-11-14T11:44:24.743Z level=WARN msg=http.request service=openconsole version=2.22.0 method=POST path=/api/auth/login status=401 duration_ms=290 remote_ip=172.17.0.1 request_id=docs-example-1 user_agent=curl/8.7.1
time=2026-11-14T11:44:24.774Z level=INFO msg=audit service=openconsole version=2.22.0 event=user.login verb=login outcome=failed reason=bad_password user=admin resource_type=user resource_name=admin request_id=docs-example-1 remote_ip=172.17.0.1 user_agent=curl/8.7.1 account_source=local
```

```json title="LOG_FORMAT=json"
{"time":"2026-11-14T11:44:24.39464748Z","level":"WARN","msg":"http.request","service":"openconsole","version":"2.22.0","method":"POST","path":"/api/auth/login","status":401,"duration_ms":230,"remote_ip":"172.17.0.1","request_id":"docs-example-1","user_agent":"curl/8.7.1"}
{"time":"2026-11-14T11:44:24.42660799Z","level":"INFO","msg":"audit","service":"openconsole","version":"2.22.0","event":"user.login","verb":"login","outcome":"failed","reason":"bad_password","user":"admin","resource_type":"user","resource_name":"admin","request_id":"docs-example-1","remote_ip":"172.17.0.1","user_agent":"curl/8.7.1","account_source":"local"}
```

A request made with an API key and an audit event with `LOG_FORMAT=ecs`:

```json title="LOG_FORMAT=ecs"
{"@timestamp":"2026-11-14T11:33:35.098421Z","log":{"level":"info","logger":"http"},"message":"GET /api/auth/me 200",
 "service":{"name":"openconsole","version":"2.22.0","environment":"prod"},"ecs":{"version":"8.11.0"},
 "http":{"request":{"method":"GET","id":"IfagdSYu-juQwKa8"},"response":{"status_code":200,"body":{"bytes":904}}},
 "url":{"path":"/api/auth/me"},"event":{"duration":51677741,"kind":"event","category":["web"],"type":["access"],
 "outcome":"success","dataset":"openconsole.app"},"source":{"ip":"127.0.0.1"},"user_agent":{"original":"node"},
 "openconsole":{"api_key":{"id":1,"name":"triage-bot"}}}

{"@timestamp":"2026-11-14T11:33:34.714411Z","log":{"level":"info","logger":"audit"},
 "message":"admin: deployment.scale success crashlab/web on demo",
 "service":{"name":"openconsole","version":"2.22.0","environment":"prod"},"ecs":{"version":"8.11.0"},
 "event":{"action":"deployment.scale","kind":"event","category":["configuration"],"type":["change"],
 "outcome":"success","dataset":"openconsole.audit"},
 "openconsole":{"verb":"scale","outcome":"success","auth_source":"local","cluster":"demo","cluster_id":1,
 "namespace":"crashlab","resource_type":"deployment","resource_name":"web","replicas_from":1,"replicas_to":2},
 "user":{"name":"admin"},"http":{"request":{"id":"wWqvhvT3HewFXXqD"}},"source":{"ip":"127.0.0.1"},
 "user_agent":{"original":"node"}}
```

What each `json` field is called in `ecs`:

| `json` | `ecs` |
|---|---|
| `time`, `level`, `msg` | `@timestamp` (UTC), `log.level` (lower case), `message` (requests: `GET /path 401`; audit: `user: action outcome namespace/name on cluster (reason)`) |
| `service`, `version`, `env` | `service.name`, `service.version`, `service.environment` |
| `user`, `user_agent`, `remote_ip` | `user.name`, `user_agent.original`, `source.ip` |
| `method`, `path`, `status`, `request_id` | `http.request.method`, `url.path`, `http.response.status_code`, `http.request.id` |
| `duration_ms` | `event.duration` (nanoseconds, measured, not rounded) |
| — | `http.response.body.bytes` |
| `event` (audit action), `reason`, `error`, `trace_id` | `event.action`, `event.reason`, `error.message`, `trace.id` |
| `api_key_id`, `api_key_name` | `openconsole.api_key.id`, `openconsole.api_key.name`: on audit events **and** on request lines; absent for a web session |
| everything else (`verb`, `outcome`, `cluster`, `namespace`, `resource_name`, audit details such as `replicas_to`, …) | `openconsole.<name>` |

Every `ecs` record has `event.dataset`: `openconsole.audit` for audit events, `openconsole.app` for everything else,
and `log.logger` is `http` or `audit` on those two kinds. Request records carry `event.category: [web]`,
`event.type: [access]` and `event.outcome` (`failure` for 4xx / 5xx). Audit events carry `event.outcome`
(`success`, or `failure` for denied / failed / rate_limited / locked; the exact value is `openconsole.outcome`),
`event.type` from the verb (`access` for reads, `change`, `creation`, `deletion`, `start` / `end` for shells and
sign-ins) and, where it applies, `event.category` (`authentication`, `session`, `process`, `iam`,
`configuration`). The full list of actions and details is in [Audit events](/reference/audit-events).

`openconsole.namespace`, `openconsole.resource_name` and the other `openconsole.*` fields describe the object the
action was performed on. Your shipper's own `kubernetes.*` and `container.*` fields describe the OpenConsole pod
that wrote the line; the two never mix.

With tracing on, the start-up line `tracing enabled` is printed before the JSON logger is set up, so it arrives as
plain text (`2026/11/14 11:42:09 INFO tracing enabled service=openconsole`). Every other line follows `LOG_FORMAT`.

## Levels

`LOG_LEVEL` is `debug`, `info` (default), `warn` or `error`.

| Record | Level |
|---|---|
| request answered 5xx | `error` |
| request answered 4xx | `warn` |
| successful `/healthz`, `/livez`, `/readyz` and `/metrics` | `debug`, so probes and scrapes don't fill the log; failing ones keep their level |
| other requests, audit events | `info` |
| Kubernetes client | `info` for a failed list, `error` for a failed watch |

`debug` adds only the successful probe and scrape lines; it doesn't log request bodies.

## Linking a request and its audit event

Every response carries an `X-Request-Id` header. The same id is on the request line (`http.request.id`) and on
the audit events the request caused, so one search finds both:

```bash
curl -si http://localhost:8080/api/auth/login -d '{"username":"admin","password":"wrong"}' | grep -i x-request-id
# X-Request-Id: p0ROI8YNQqdXURAg
```

If the request already has an `X-Request-Id` header (set by your ingress or gateway), OpenConsole keeps it instead
of making a new one, so the id runs through your proxy's access log too. With [tracing](/operations/tracing) on,
request lines also carry `trace.id`.

The Admin → Audit Logs screen shows the same request id on each event
([From an event to the request log](/administration/audit-log#from-an-event-to-the-request-log)).

## Other settings

| Variable | Default | Meaning |
|---|---|---|
| `LOG_OUTPUT` | `stdout` | `stdout` or `stderr` |
| `LOG_ADD_SOURCE` | `false` | add the source file and line (`log.origin.*` in `ecs`) |
| `LOG_INCLUDE_AUDIT` | `true` | write every audit event to stdout as well as to the database. With `false`, audit events are only in the database (Admin → Audit Logs, CSV) |
| `APP_ENV` | empty (the manifest sets `prod`) | `service.environment` on every line, `deployment.environment` on traces |
| `APP_VERSION` | the image's version | overrides `service.version`, e.g. to tell a canary apart |

All variables: [Environment variables](/reference/environment-variables).

## Retention

The database keeps audit events for `LOG_RETENTION_DAYS` (30), and successful reads made with an API key for
`API_KEY_READ_RETENTION_DAYS` (7). stdout lines are not affected by either: how long they stay is up to your log
platform. If you need the audit trail for longer than 30 days, ship stdout ([Elastic](/operations/elastic)) and set
the retention there.
