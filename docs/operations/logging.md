---
title: "Logging and Elastic"
description: "Structured logs (text, json, ecs) and shipping them to Elastic."
---

# Logging and Elastic

Logs go to stdout, one record per line. With `json` or `ecs` every line, including client-go's own messages, is a single JSON object, so Elastic Agent, Filebeat, Logstash, Fluent Bit or Vector can read it without grok. See [Shipping logs to Elastic](/operations/logging#shipping-logs-to-elastic).

- `LOG_FORMAT` (default `text`):
  - `ecs` — nested JSON following the [Elastic Common Schema](https://www.elastic.co/guide/en/ecs/current/index.html), the same shape as other ECS-logging services. Use this for Elastic. `deploy/deployment.yaml` sets it.
  - `json` — flat JSON with short field names (`time`, `level`, `msg`, `user`, …), for Loki / Vector or your own parsing.
  - `text` — for reading `kubectl logs` by eye.
- `LOG_LEVEL` (default `info`) — `debug` | `info` | `warn` | `error`. Successful health probes (`/healthz`, `/livez`, `/readyz`) and `/metrics` scrapes are logged at `debug` only, so they don't flood the log; failing ones still show up.
- `LOG_OUTPUT` (default `stdout`) — `stdout` | `stderr`.
- `LOG_ADD_SOURCE` (default `false`) — include the source file and line (`log.origin.*` in ECS).
- `LOG_INCLUDE_AUDIT` (default `true`) — mirror every audit entry to stdout, one line per action ([Audit events](/reference/audit-events)). It carries the same request id as the matching HTTP request record. With `false` audited actions write nothing to stdout (the database still has them).
- `APP_ENV`, `APP_VERSION` — static labels on every record (`service.environment`, `service.version`). `deploy/deployment.yaml` sets `APP_ENV=prod`; change it per cluster. Release images already carry their version; set `APP_VERSION` only to override it, e.g. for a canary.

An HTTP request and an audit event with `LOG_FORMAT=ecs` (one line each; wrapped here):

```json
{"@timestamp":"2026-10-13T14:40:46.449346Z","log":{"level":"warn","logger":"http"},"message":"GET /api/namespaces 401",
 "service":{"name":"openconsole","version":"2.16.2","environment":"prod"},"ecs":{"version":"8.11.0"},
 "http":{"request":{"method":"GET","id":"bOPVk_3c0Qwaoe9g"},"response":{"status_code":401,"body":{"bytes":27}}},
 "url":{"path":"/api/namespaces"},"event":{"duration":509909,"kind":"event","category":["web"],"type":["access"],
 "outcome":"failure","dataset":"openconsole.app"},"source":{"ip":"10.31.67.52"},"user_agent":{"original":"Mozilla/5.0 …"}}

{"@timestamp":"2026-10-15T14:55:22.123456Z","log":{"level":"info","logger":"audit"},
 "message":"mustafav: deployment.scale success payments/nginx on prod-aks",
 "service":{"name":"openconsole","version":"2.17.0","environment":"prod"},"ecs":{"version":"8.11.0"},
 "event":{"action":"deployment.scale","kind":"event","category":["configuration"],"type":["change"],
 "outcome":"success","dataset":"openconsole.audit"},
 "openconsole":{"verb":"scale","outcome":"success","auth_source":"azure","cluster":"prod-aks","cluster_id":2,
 "namespace":"payments","resource_type":"deployment","resource_name":"nginx","replicas_from":3,"replicas_to":5},
 "user":{"name":"mustafav"},"http":{"request":{"id":"qXpB6yXONDiuXKX2"}},"source":{"ip":"10.31.67.52"},
 "user_agent":{"original":"Mozilla/5.0 …"}}
```

What each `json` field becomes in `ecs`:

| `json` | `ecs` |
|---|---|
| `time`, `level`, `msg` | `@timestamp` (UTC), `log.level` (lower case), `message` (for requests: `GET /path 401`; for audit events: `user: action outcome namespace/name on cluster (reason)`) |
| `service`, `version`, `env` | `service.name`, `service.version`, `service.environment` |
| `user`, `user_agent`, `remote_ip` | `user.name`, `user_agent.original`, `source.ip` |
| `method`, `path`, `status`, `request_id` | `http.request.method`, `url.path`, `http.response.status_code`, `http.request.id` |
| `duration_ms` | `event.duration` (nanoseconds, measured, not rounded) |
| — | `http.response.body.bytes` |
| `event` (audit action), `reason`, `error`, `trace_id` | `event.action`, `event.reason`, `error.message`, `trace.id` |
| `api_key_id`, `api_key_name` | `openconsole.api_key.id`, `openconsole.api_key.name`: the [API key](/api/overview) on audit events **and** on `http.request` lines (also a refused key's), absent for a web session. Tell API from web with `openconsole.api_key.id : *`, not the user agent, which the client chooses |
| everything else (`verb`, `outcome`, `cluster`, `namespace`, `resource_name`, audit details such as `replicas_to`, …) | `openconsole.<name>` |

Every `ecs` record also has `event.dataset`: `openconsole.audit` for audit events, `openconsole.app` for the rest. HTTP requests carry `event.kind: event`, `event.category: [web]`, `event.type: [access]` and `event.outcome` (`failure` for 4xx / 5xx). Audit events carry `event.kind: event`, `event.outcome` (`success`, or `failure` for denied / failed / rate_limited / locked; the exact value is in `openconsole.outcome`), `event.type` from the verb (`access` for reads, `change`, `creation`, `deletion`, `start` / `end` for shells and sign-ins) and, where it applies, `event.category` (`authentication`, `session`, `process`, `iam`, `configuration`). `log.logger` is `http` or `audit`.

`namespace` / `pod` / `container` describe the resource the action was performed on, so they live under `openconsole.*`. The shipper's own `kubernetes.*` and `container.*` fields describe the OpenConsole pod that wrote the line. The two never mix.

Every HTTP response also carries an `X-Request-Id` header matching the request id.

## Shipping logs to Elastic

Pick the variant that matches your setup. All of them read the container's stdout and need no grok.

**Elastic Agent managed by Fleet, with the Kubernetes integration already collecting container logs (recommended).** Leave the integration as it is and run [`deploy/elk/install.sh`](https://github.com/vurulkan/kubernetes-openconsole/blob/main/deploy/elk/README.md) once against Elasticsearch:

```bash
ES_URL=https://elasticsearch.example:9200 ES_API_KEY=<base64 id:key> deploy/elk/install.sh
```

It installs an ingest pipeline that the Kubernetes integration calls for every container log line (through `logs-kubernetes.container_logs@custom`). The pipeline:
- decodes only OpenConsole's lines, so other pods' lines stay as they are;
- keeps Agent's `kubernetes.*` / `container.*` / `log.file.path` fields;
- sets `event.outcome` on audit events, and gives audit lines from before 2.17 the 2.17 shape (see [Upgrading from 2.16](/installation/upgrading#upgrading-from-216));
- routes the records to two data streams with proper mappings: `logs-openconsole.audit-*` (audit events) and `logs-openconsole.app-*` (everything else).

This is a one-time step on the Elasticsearch side; nothing changes in the Agent policy. **Without it the logs still arrive, but unparsed.** Each line sits as one JSON string in `message` in `logs-kubernetes.container_logs-*`, so there is no `user.name` / `event.action` / status code to filter or chart on, audit and application records are mixed, and `@timestamp` is the time Agent read the line. If you can't run the script, the same four requests can be sent from Kibana Dev Tools ([deploy/elk/README.md](https://github.com/vurulkan/kubernetes-openconsole/blob/main/deploy/elk/README.md#without-installsh)).

Requires Elasticsearch 8.8 or later. Tested on 8.15.3 and 9.1.0 with real OpenConsole lines; see [deploy/elk/README.md](https://github.com/vurulkan/kubernetes-openconsole/blob/main/deploy/elk/README.md) for the details, KQL examples and how to remove it.

**Elastic Agent standalone, or Filebeat.** Add a filestream input for the OpenConsole pods' log files. The `container` parser strips the CRI prefix and `ndjson` decodes the record into the root:

```yaml
- type: filestream
  id: openconsole
  paths:
    - /var/log/containers/kubernetes-openconsole-*_kubernetes-openconsole_*.log
  parsers:
    - container: {}
    - ndjson:
        target: ""
        overwrite_keys: true   # @timestamp and message come from the record
        expand_keys: true      # only needed for lines from 2.16.1 (dotted keys)
        add_error_key: true
  processors:
    - add_kubernetes_metadata: {}
```

In Elastic Agent standalone this goes under `inputs:` with a `data_stream: {dataset: openconsole}`; in Filebeat under `filebeat.inputs:`. Exclude these files from your generic container input so lines aren't shipped twice.

**Logstash.** The `json` filter puts the keys at the root and takes `@timestamp` from the record:

```ruby
filter {
  if [kubernetes][labels][app] == "kubernetes-openconsole" {
    json { source => "message" skip_on_invalid_json => true }
  }
}
```

With `LOG_FORMAT=json` instead of `ecs`, decode into a sub-object so the short names can't collide with ECS fields: `ndjson` with `target: "openconsole"`, or `json { source => "message" target => "openconsole" }`, plus a date mapping for `openconsole.time`.
