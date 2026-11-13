---
title: "Upgrading"
description: "How to move to a new release, what happens to the database, and how to go back."
---

# Upgrading

## Before you start

1. **Read the release notes of every version between yours and the new one** ([Release notes](/release-notes)).
   The version-specific steps are also [below](#version-notes). Your version: hover the GitHub icon at the bottom of the left
   rail, or read the first log line of the pod (`"version":"…"`).
2. **Back up the volume** ([Backup and restore](/installation/backup-restore)). It is the only way back to the
   exact state before the upgrade.
3. Make sure the Deployment uses `strategy: Recreate` ([Install on Kubernetes](/installation/kubernetes)). With
   the default rolling update the new pod opens the database while the old one still runs; on 2.22.0 that can
   lose writes until the next restart.

You can skip versions: going from 2.21.0 to 2.22.0 or from 2.16 to 2.22 is one step. Each release brings its
database changes along and applies the missing ones on start.

## Upgrade

Change the version in both places of your `kustomization.yaml` and apply it:

```yaml title="kustomization.yaml"
resources:
  - https://github.com/vurulkan/kubernetes-openconsole//deploy?ref=v2.22.0   # was v2.21.0
images:
  - name: ghcr.io/vurulkan/kubernetes-openconsole
    newTag: "2.22.0"                                                         # was 2.21.0
```

```bash
kubectl diff -k .      # the image tag, plus whatever the release changed in deploy/
kubectl apply -k .
kubectl -n kubernetes-openconsole rollout status deploy/kubernetes-openconsole --timeout=5m
kubectl -n kubernetes-openconsole logs deploy/kubernetes-openconsole | head -3   # "version":"2.22.0"
```

Sessions stay valid, so signed-in users carry on after a page reload. With `Recreate` the console is unavailable
for the few seconds the new pod needs to start.

**If you run the manifests unpinned** (`:latest` with `imagePullPolicy: Always`, as in `deploy/`), a
`kubectl -n kubernetes-openconsole rollout restart deploy/kubernetes-openconsole` pulls the newest release. The
manifests themselves (ClusterRole rules, new variables) are only updated when you apply the new `deploy/` again.

**The ClusterRole** may gain rules in a release (e.g. `nodes` `watch` in 2.20). It comes with `deploy/` in the
cluster OpenConsole runs in; on every other connected cluster apply the new `rbac.yaml` yourself
([Connect a cluster](/installation/connect-cluster#1-create-the-serviceaccount)).

## What happens to the database

- Migrations run automatically on the first start of the new version: they add tables and columns, and some
  releases rewrite existing rows once (2.17 gave old audit rows the new action / outcome fields). There is no step
  to run by hand.
- There are no down-migrations. Going back to an older version is not supported. In practice the older version
  usually starts on the newer database because the changes only add (checked: 2.21.0 on a 2.22.0 database), but
  data the newer version wrote can be ignored or misread.

## Going back

1. Set the previous version in `kustomization.yaml` and `kubectl apply -k .`.
2. If the older version misbehaves on the newer database, [restore the backup](/installation/backup-restore#restore)
   you took before the upgrade. Everything since the backup (audit events, users, settings) is lost.

## Version notes

### Upgrading to 2.22

- **Elastic**: re-run [`deploy/elk/install.sh`](https://github.com/vurulkan/kubernetes-openconsole/blob/main/deploy/elk/README.md) once: it adds the mapping of `openconsole.api_key.id` / `.name`, `openconsole.admin_scope`, `openconsole.expires_at`, `openconsole.api_access`, `openconsole.by_admin`, `openconsole.comment`, `openconsole.mode`, `openconsole.program` and `openconsole.recording_id` (the pipeline is unchanged). If you don't, nothing is lost: the fields are mapped dynamically, and get the right type from the next rollover after you run it.
- **Database**: new tables and columns are added on the first start; nothing to do.
- **Elasticsearch 8.7** (no `reroute`, so no `install.sh`): see `deploy/elk/README.md` → *Elasticsearch 8.7 and older* for the same steps by hand, an ILM policy, and adding the new fields to the live index.
- **Logs**: `http.request` lines now carry `openconsole.api_key.id` / `.name` for requests made with a key (also refused ones); `openconsole.api_key.id : *` separates API from web in the application log as in the audit log.
- **403 bodies** name the reason (`{"error": "forbidden"}`, `api_key_not_allowed`, `admin_only`, `feature_disabled`, `api_access_policy`, `api_access_off`) instead of a sentence or an empty body; the audit CSV gains a last column `api_key_name`.
- **API key policy**: every existing role starts at **Safe read-only** API access, so keys made before the upgrade lose exec, edit, scale, restart, ConfigMaps and Secrets until an admin opens a role (Admin → Roles → *API access*). The keys themselves are not changed: they work as before once the policy allows it.

### Upgrading from 2.16

Before 2.17 the outcome was part of the action (`deployment.restart.success`), reads were a bare verb (`list` with `resource_type: deployments`) and details sat in the resource name (`boh (restartedAt=…)`).

- **Database**: on the first start of 2.17 the existing audit rows get the new `action`, `verb`, `outcome` and a singular `resource_type`. Their resource names keep the old `(k=v)` suffix; with the default 30-day retention those rows age out on their own.
- **API**: `?action=deployment.restart.success` still works; the outcome is split off.
- **Elastic**: re-run `deploy/elk/install.sh`. The new mapping applies from the next rollover of `logs-openconsole.audit-*` (`POST logs-openconsole.audit-default/_rollover` to apply it now). The pipeline gives 2.16 lines the 2.17 shape (action without the outcome, `openconsole.verb`, `openconsole.outcome`, `event.type`), so one query finds old and new events. Saved searches, visualizations and alerts that filter on `event.action : *.success` / `*.denied` must be changed to `event.action` + `event.outcome` (or `openconsole.outcome`).
- **Console**: the extra `deployment.action`, `workload.action`, `secret.action`, `yaml.apply`, `recording.action`, `pod.exec.start` / `pod.exec.end`, `*.logs.start`, `user.password_reset` and `user.auto_provision` lines are gone, and so are the `level=error` lines `deployment.restart.failed`, `deployment.scale.failed`, `statefulset.scale.failed` and `<resource>.apply.failed`; the `audit` line has all their fields. A failed action is `event.outcome : "failure"` with `event.reason` and `error.message`. `level=error` is left for faults in OpenConsole itself (e.g. `http.panic`).
