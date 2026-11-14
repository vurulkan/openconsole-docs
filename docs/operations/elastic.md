---
title: "Elastic"
description: "Send OpenConsole's audit events and request logs to Elasticsearch, keep them as long as you need, and query them in Kibana."
---

# Elastic

With `LOG_FORMAT=ecs` (the manifest's setting) every line OpenConsole writes is one JSON object in Elastic Common
Schema field names ([Logging](/operations/logging)). The files in
[`deploy/elk`](https://github.com/vurulkan/kubernetes-openconsole/tree/v2.22.0/deploy/elk) turn those lines into
two data streams with typed fields:

| Data stream | What |
|---|---|
| `logs-openconsole.audit-<namespace>` | audit events: who did what, where, with which outcome (`event.dataset: openconsole.audit`) |
| `logs-openconsole.app-<namespace>` | everything else: request lines, start-up, Kubernetes client messages (`event.dataset: openconsole.app`) |

The pipeline only touches OpenConsole's lines (JSON with `service.name: openconsole`); other containers' lines
pass through unchanged. A line it can't parse keeps its raw `message`, gets the tag `openconsole_json_failure` and
stays where it arrived.

Requires Elasticsearch 8.8 or later. Every command and query on this page was run against Elasticsearch **8.15.3**
and **9.1.0** with lines from OpenConsole 2.22.0. For 8.7, see
[Elasticsearch 8.7 and older](https://github.com/vurulkan/kubernetes-openconsole/blob/v2.22.0/deploy/elk/README.md#elasticsearch-87-and-older).

## 1. Install the pipeline and templates

From a checkout of the code repository at the release you run:

```bash
git clone --depth 1 --branch v2.22.0 https://github.com/vurulkan/kubernetes-openconsole.git
cd kubernetes-openconsole
ES_URL=https://elasticsearch.example:9200 ES_API_KEY=<base64 id:key> deploy/elk/install.sh
# or ES_USER=elastic ES_PASSWORD=…; ES_INSECURE=1 for a self-signed certificate
```

```text
ok   PUT /_component_template/openconsole@mappings
ok   PUT /_index_template/logs-openconsole
ok   PUT /_ingest/pipeline/openconsole-logs
ok   PUT /_ingest/pipeline/logs-kubernetes.container_logs@custom
```

The API key needs the `manage_index_templates` and `manage_pipeline` cluster privileges. The script is safe to run
again, e.g. after an upgrade that adds fields. If `logs-kubernetes.container_logs@custom` already exists, the script
leaves it alone and prints the one processor to add to it. Without shell access, send the same four requests from
Kibana → Dev Tools ([Without install.sh](https://github.com/vurulkan/kubernetes-openconsole/blob/v2.22.0/deploy/elk/README.md#without-installsh)).

## 2. Ship the lines

### Elastic Agent with the Kubernetes integration

If Fleet's Kubernetes integration already collects your container logs, there is nothing to change in the Agent
policy. The integration's pipeline calls `logs-kubernetes.container_logs@custom` for every line, `install.sh` made
that pipeline call `openconsole-logs`, and the OpenConsole lines move to the two data streams above. Lines written
before the installation stay as they arrived.

### Filebeat or Elastic Agent standalone

Read the OpenConsole pod's log files, keep the line as it is, and hand it to the same pipeline:

```yaml title="filebeat.yml"
filebeat.inputs:
  - type: filestream
    id: openconsole
    paths:
      - /var/log/containers/kubernetes-openconsole-*_kubernetes-openconsole_*.log
    prospector.scanner.symlinks: true    # the files in /var/log/containers are symlinks
    parsers:
      - container: {}                    # strips the CRI prefix
    pipeline: openconsole-logs
    index: logs-openconsole-default      # a data stream name; the pipeline moves each line on from there
    processors:
      - add_kubernetes_metadata:
          node: ${NODE_NAME}
          matchers:
            - logs_path:
                logs_path: /var/log/containers/
output.elasticsearch:
  hosts: ["https://elasticsearch.example:9200"]
```

- `index` must be a data stream name (`logs-<dataset>-<namespace>`): the pipeline's last step moves the line to
  `logs-openconsole.audit-default` or `…app-default` and refuses an index like `filebeat-9.1.0`.
- Exclude the same files from your generic container input, or every line arrives twice.
- In Elastic Agent standalone the input goes under `inputs:` with the same `paths`, `parsers` and `pipeline`.

## 3. Check

After the next request to OpenConsole (from Dev Tools, or with `curl` against Elasticsearch):

```text
GET logs-openconsole.audit-*/_search
{ "size": 3, "sort": [{ "@timestamp": "desc" }], "_source": ["@timestamp", "message"] }
```

```text
GET _cat/indices/*openconsole*?v&h=index,docs.count
index                                                docs.count
.ds-logs-openconsole.app-default-2026.11.14-000001         1301
.ds-logs-openconsole.audit-default-2026.11.14-000001         70
```

In Kibana, create a data view for `logs-openconsole.audit-*` and one for `logs-openconsole.app-*`
(Stack Management → Data views), with `@timestamp` as the time field.

## Questions the audit log answers

Kibana → Discover, data view `logs-openconsole.audit-*`, KQL:

| Question | KQL |
|---|---|
| Who revealed which secret? | `event.action : "secret.reveal" and event.outcome : "success"` |
| Who opened a shell? | `event.action : "pod.exec" and openconsole.phase : "start"` |
| Who ran one command over the API? | `event.action : "pod.exec" and openconsole.mode : "command"` |
| What was refused? | `openconsole.outcome : "denied"` |
| Failed and locked sign-ins | `event.action : "user.login" and (openconsole.outcome : "failed" or openconsole.outcome : "locked")` |
| Restarts and scaling | `(event.action : "deployment.restart" or event.action : "deployment.scale" or event.action : "statefulset.scale") and event.outcome : "success"` |
| YAML applied for real (not dry-run) | `openconsole.verb : "apply" and openconsole.dry_run : false` |
| Everything an API key did | `openconsole.api_key.name : "triage-bot"` |
| Users, groups, roles and grants changed | `event.category : "iam"` |
| Everything that failed for one user | `user.name : "dev1" and event.outcome : "failure"` |
| Shells refused by the per-user limit | `event.action : "pod.exec" and openconsole.outcome : "rate_limited"` |

Useful columns: `user.name`, `event.action`, `openconsole.outcome`, `event.reason`, `openconsole.cluster`,
`openconsole.namespace`, `openconsole.resource_name`, `source.ip`. A secret reveal also has `openconsole.key` (the
key's name, never its value); a shell has `openconsole.container`, `openconsole.command` and, when it ends,
`openconsole.exit_code` and `openconsole.duration_ms`.

Data view `logs-openconsole.app-*`:

| Question | KQL |
|---|---|
| Server errors | `http.response.status_code >= 500` |
| Requests an API key made that failed | `http.response.status_code >= 400 and openconsole.api_key.id : *` |
| Requests slower than 1 s | `event.duration > 1000000000` |
| Kubernetes client errors (watches failing, credentials refused) | `log.level : "error"` |
| Sign-in attempts from a network | `url.path : "/api/auth/login" and source.ip : "10.0.0.0/8"` |
| One request and what it caused | `http.request.id : "wWqvhvT3HewFXXqD"` (in both data views) |

The same questions in ES|QL (Discover → ES|QL, or `POST _query` on 8.11 and later), for a table:

```sql
FROM logs-openconsole.audit-*
| WHERE event.action == "secret.reveal"
| KEEP @timestamp, user.name, event.outcome, openconsole.cluster, openconsole.namespace, openconsole.resource_name, openconsole.key
| SORT @timestamp DESC
```

```sql
FROM logs-openconsole.audit-*
| WHERE event.action == "pod.exec" AND openconsole.phase == "start"
| KEEP @timestamp, user.name, openconsole.cluster, openconsole.namespace, openconsole.resource_name, openconsole.container, openconsole.command, source.ip
| SORT @timestamp DESC
```

```sql
FROM logs-openconsole.audit-*
| WHERE openconsole.outcome == "denied"
| STATS refusals = COUNT(*) BY user.name, event.action, event.reason
| SORT refusals DESC
```

## Keep the audit trail as long as you need

On 8.8 and later the two data streams get the stack's `logs` lifecycle policy, which rolls over but **never deletes**.
To keep OpenConsole's lines for a fixed time (here a year), give them their own policy:

```text
PUT _ilm/policy/openconsole-logs
{
  "policy": {
    "_meta": { "description": "OpenConsole audit and app logs" },
    "phases": {
      "hot":    { "actions": { "rollover": { "max_age": "30d", "max_primary_shard_size": "10gb" } } },
      "delete": { "min_age": "365d", "actions": { "delete": {} } }
    }
  }
}

PUT _component_template/openconsole@settings
{ "template": { "settings": { "index.lifecycle.name": "openconsole-logs" } } }
```

Add `"openconsole@settings"` at the end of `composed_of` in `deploy/elk/logs-openconsole.index-template.json` and
`PUT _index_template/logs-openconsole` with that file. New backing indices then get the policy; give it to the
ones that exist:

```text
PUT logs-openconsole.audit-*,logs-openconsole.app-*/_settings
{ "index.lifecycle.name": "openconsole-logs" }

GET logs-openconsole.audit-*/_ilm/explain     ← every index "managed": true, "policy": "openconsole-logs"
```

Keep your copy of the index template: `install.sh` puts the file from the repository back, without
`openconsole@settings`, when you run it again. Don't use `logs@custom` for this: every `logs-*` data stream reads it.

## After an upgrade

Run `install.sh` from the new release. New fields apply from the next backing index; to get them now, roll over:

```text
POST logs-openconsole.audit-default/_rollover
POST logs-openconsole.app-default/_rollover
```

The release notes say when a release adds fields (2.22 added ten). Details:
[deploy/elk/README.md](https://github.com/vurulkan/kubernetes-openconsole/blob/v2.22.0/deploy/elk/README.md).

## Remove

```text
DELETE _ingest/pipeline/logs-kubernetes.container_logs@custom   ← only if install.sh created it
DELETE _ingest/pipeline/openconsole-logs
DELETE _index_template/logs-openconsole
DELETE _component_template/openconsole@mappings
```

The data streams and what they hold stay until you delete them: `DELETE _data_stream/logs-openconsole.*`.
