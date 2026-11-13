---
title: "Audit events"
description: "Fields, details and Kibana examples."
---

# Audit events

Every audited action is one event, stored in the database (Admin → Audit Logs, CSV) and, with `LOG_INCLUDE_AUDIT=true`, written to stdout as one `audit` line. The same fields are everywhere, so filters work the same in the UI and in Kibana:

| Field (`json` / DB) | `ecs` | Meaning |
|---|---|---|
| `event` / `action` | `event.action` | `<resource type>.<verb>`: `deployment.list`, `deployment.restart`, `pod.exec`, `secret.reveal`, `node.get`, `user.login`, `permission.create` |
| `verb` | `openconsole.verb` | `list` `get` `logs` `exec` `restart` `scale` `apply` `view_yaml` `reveal` `view` `download` `create` `update` `delete` `share` `select` `activate` `deactivate` `revoke` `export` `import` `login` `change_password` `reset_password` `evict` `purge` `view_overview` `regenerate` `use` |
| `outcome` | `openconsole.outcome`, `event.outcome` | `success` `denied` `failed` `rate_limited` `locked` (`event.outcome` is `success` / `failure`) |
| `reason` | `event.reason` | why it was denied or failed: `forbidden`, `feature_disabled`, `admin_only`, `k8s_forbidden`, `not_found`, `conflict`, `bad_password`, … |
| `user`, `auth_source` | `user.name`, `openconsole.auth_source` | who, and where the account signs in (`local` / `ldap` / `azure`) |
| `remote_ip`, `user_agent`, `request_id` | `source.ip`, `user_agent.original`, `http.request.id` | from where; the request id matches the `http.request` line |
| `api_key_id`, `api_key_name` | `openconsole.api_key.id`, `openconsole.api_key.name` | the [API key](/api/api-keys) the action was taken with; empty for a web session |
| `cluster`, `cluster_id` | `openconsole.cluster`, `openconsole.cluster_id` | the cluster the action **targeted**. Empty for actions that don't run on a cluster (sign-ins, users, groups, roles, settings, sessions, saved views). A permission grant records the grant's cluster (empty for "all clusters"), not the cluster the admin had selected. |
| `namespace`, `resource_type`, `resource_name` | `openconsole.*` | the target; `resource_type` is singular (`deployment`), `resource_name` is the bare name, `*` for a list |
| details | `openconsole.<key>` | typed, see below |

Details are a fixed set of keys, each with a type in the Elastic mapping:

| Action | Details |
|---|---|
| `deployment.restart` | `restarted_at` (date) |
| `deployment.scale`, `statefulset.scale` | `replicas_from`, `replicas_to` |
| `<kind>.apply` | `dry_run`, `yaml_from`, `yaml_to` (sha256 prefixes, never the YAML) |
| `pod.exec` | shell: `phase` (`start` / `end`), `container`, `command`; at the end `exit_code`, `bytes_in`, `bytes_out`, `duration_ms`. One command (`POST …/exec`): `mode` (`command`), `container`, `program` (the first element only, never the full command), `exit_code`, `bytes_out`, `duration_ms`, `recording_id` |
| `pod.logs`, `deployment.logs`, `job.logs` | `container` / `pods`; `previous` (true) for the log before the last restart |
| `secret.reveal` | `key` (the key name, never the value) |
| `recording.*` | `pod`, `container`, `owner`, `started_at`, `size_bytes`, `truncate_reason`, `count`, `retention_days` |
| `user.login` | `login_method`, `linked_by`, `signed_in_as`, `account_source` |
| `api_key.*` | `id`, `summary` (clusters / namespaces count and grants), `expires_at`, `admin_scope`, `changed`; never the secret or its hash. An admin's revoke: `by_admin` (true), `owner`, `comment` (the optional reason); revoking all of a user's keys: `all`, `count`, `owner`, `by_admin` |
| `user.*`, `group.*`, `role.*`, `permission.*` | `changed` (field names, not values), `is_admin`, `is_active`, `account_source`, `groups`, `count`, `role`, `grant` (`deployments:restart`), `auto_provisioned`; `api_access` when a role's API access (`off` / `safe_read` / `full`) or a user's override (the same, or `roles`) changes |
| any failure | `error` (→ `error.message` in ECS) |

Reads are audited too (`deployment.list`, `pod.get`, `pod.logs`, …), including a refused one (`denied`, reason `forbidden`). Lists the UI fetches on its own are not: the dashboard's reload every 10 seconds, and the namespace list behind the command palette and the role editor (they send `X-OpenConsole-Refresh: auto`). The lists you open are audited, and the HTTP request log still has every request. With an API key the header is ignored: every read is audited.

Kibana examples:

```text
openconsole.verb : "exec" and openconsole.cluster : "Zenia-NonProd"
event.action : "deployment.restart" and event.outcome : "failure"
openconsole.resource_name : "boh" and openconsole.namespace : "boh-cy"
openconsole.replicas_to >= 10
event.action : "pod.exec" and openconsole.phase : "end" and not openconsole.exit_code : 0
openconsole.outcome : "denied" and user.name : "dev1"
```
