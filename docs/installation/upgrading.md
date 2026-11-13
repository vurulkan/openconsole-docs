---
title: "Upgrading"
description: "Version-specific upgrade notes."
---

# Upgrading

## Upgrading to 2.22

- **Elastic**: re-run `deploy/elk/install.sh` once: it adds the mapping of `openconsole.api_key.id` / `.name`, `openconsole.admin_scope`, `openconsole.expires_at`, `openconsole.api_access`, `openconsole.by_admin`, `openconsole.comment`, `openconsole.mode`, `openconsole.program` and `openconsole.recording_id` (the pipeline is unchanged). If you don't, nothing is lost: the fields are mapped dynamically, and get the right type from the next rollover after you run it.
- **Database**: new tables and columns are added on the first start; nothing to do.
- **Elasticsearch 8.7** (no `reroute`, so no `install.sh`): see `deploy/elk/README.md` → *Elasticsearch 8.7 and older* for the same steps by hand, an ILM policy, and adding the new fields to the live index.
- **Logs**: `http.request` lines now carry `openconsole.api_key.id` / `.name` for requests made with a key (also refused ones); `openconsole.api_key.id : *` separates API from web in the application log as in the audit log.
- **403 bodies** name the reason (`{"error": "forbidden"}`, `api_key_not_allowed`, `admin_only`, `feature_disabled`, `api_access_policy`, `api_access_off`) instead of a sentence or an empty body; the audit CSV gains a last column `api_key_name`.
- **API key policy**: every existing role starts at **Safe read-only** API access, so keys made before the upgrade lose exec, edit, scale, restart, ConfigMaps and Secrets until an admin opens a role (Admin → Roles → *API access*). The keys themselves are not changed: they work as before once the policy allows it.

## Upgrading from 2.16

Before 2.17 the outcome was part of the action (`deployment.restart.success`), reads were a bare verb (`list` with `resource_type: deployments`) and details sat in the resource name (`boh (restartedAt=…)`).

- **Database**: on the first start of 2.17 the existing audit rows get the new `action`, `verb`, `outcome` and a singular `resource_type`. Their resource names keep the old `(k=v)` suffix; with the default 30-day retention those rows age out on their own.
- **API**: `?action=deployment.restart.success` still works; the outcome is split off.
- **Elastic**: re-run `deploy/elk/install.sh`. The new mapping applies from the next rollover of `logs-openconsole.audit-*` (`POST logs-openconsole.audit-default/_rollover` to apply it now). The pipeline gives 2.16 lines the 2.17 shape (action without the outcome, `openconsole.verb`, `openconsole.outcome`, `event.type`), so one query finds old and new events. Saved searches, visualizations and alerts that filter on `event.action : *.success` / `*.denied` must be changed to `event.action` + `event.outcome` (or `openconsole.outcome`).
- **Console**: the extra `deployment.action`, `workload.action`, `secret.action`, `yaml.apply`, `recording.action`, `pod.exec.start` / `pod.exec.end`, `*.logs.start`, `user.password_reset` and `user.auto_provision` lines are gone, and so are the `level=error` lines `deployment.restart.failed`, `deployment.scale.failed`, `statefulset.scale.failed` and `<resource>.apply.failed`; the `audit` line has all their fields. A failed action is `event.outcome : "failure"` with `event.reason` and `error.message`. `level=error` is left for faults in OpenConsole itself (e.g. `http.panic`).
