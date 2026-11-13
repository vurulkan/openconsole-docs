---
title: "Backup and restore"
description: "Back up the SQLite volume, keep the backup safe, and restore it in place or into a new namespace."
---

# Backup and restore

Everything OpenConsole stores is on one volume, mounted at `/data`:

| Path | What |
|---|---|
| `/data/app.db` | the SQLite database: users, groups, roles, clusters and their credentials, settings, sessions, API keys (hashed), saved views, restart history, the audit log |
| `/data/recordings/` | pod shell recordings (`.cast` files) |

:::danger Treat a backup like a secret
Cluster tokens, LDAP and Prometheus passwords and the Azure AD client secret are encrypted in the database, but
**the encryption key is in the same database**. Anyone with a copy of `app.db` can read them. Recordings may hold
whatever someone printed in a shell. Store backups encrypted, with access as tight as the clusters themselves.
:::

## Back up

The image has no `sqlite3`, and the database must not be copied while the app writes to it. So stop the app for a
moment, read the volume from a short-lived helper pod, and start the app again. The console is unavailable for
about a minute.

```bash
NS=kubernetes-openconsole
kubectl -n $NS scale deploy/kubernetes-openconsole --replicas=0
kubectl -n $NS wait --for=delete pod -l app=kubernetes-openconsole --timeout=120s

kubectl -n $NS run oc-backup --restart=Never --image=alpine:3.20 \
  --overrides='{"spec":{"securityContext":{"runAsNonRoot":true,"runAsUser":65532,"runAsGroup":65532,"fsGroup":65532,"seccompProfile":{"type":"RuntimeDefault"}},"containers":[{"name":"oc-backup","image":"alpine:3.20","command":["sleep","3600"],"securityContext":{"allowPrivilegeEscalation":false,"capabilities":{"drop":["ALL"]}},"volumeMounts":[{"name":"data","mountPath":"/data"}]}],"volumes":[{"name":"data","persistentVolumeClaim":{"claimName":"kubernetes-openconsole-data"}}]}}'
kubectl -n $NS wait --for=condition=Ready pod/oc-backup --timeout=120s

kubectl -n $NS exec oc-backup -- tar czf - -C /data . > openconsole-backup-$(date +%Y%m%d-%H%M).tgz

kubectl -n $NS delete pod oc-backup --wait=false
kubectl -n $NS scale deploy/kubernetes-openconsole --replicas=1
```

- The helper runs as the same non-root user as the app, so it passes a `restricted` Pod Security level.
- To leave the recordings out (they can be gigabytes), use
  `tar czf - -C /data --exclude=./recordings .`.
- Check the archive: `tar tzvf openconsole-backup-*.tgz` lists `./app.db` and `./recordings/`.

A volume snapshot (CSI `VolumeSnapshot`) of the PVC is an alternative if your storage supports it; take it while the
Deployment is scaled to 0, as above.

## Restore

Restoring replaces everything on the volume with the backup. It works into the same installation (lost or broken
volume) or into a new one (another namespace or cluster).

1. **Have an installation to restore into.** For the same namespace, the existing one. For a new one, install
   OpenConsole first ([Install on Kubernetes](/installation/kubernetes)); in another namespace of the **same**
   cluster, leave out `rbac.yaml` (list the files, as shown there): the ServiceAccount and ClusterRole are
   cluster-wide and the restored database already holds the original token.
2. **Copy the backup onto its volume** (set `NS` to the namespace you restore into):

```bash
NS=kubernetes-openconsole
BACKUP=openconsole-backup-20261113-2327.tgz

kubectl -n $NS scale deploy/kubernetes-openconsole --replicas=0
kubectl -n $NS wait --for=delete pod -l app=kubernetes-openconsole --timeout=120s

kubectl -n $NS run oc-backup --restart=Never --image=alpine:3.20 \
  --overrides='{"spec":{"securityContext":{"runAsNonRoot":true,"runAsUser":65532,"runAsGroup":65532,"fsGroup":65532,"seccompProfile":{"type":"RuntimeDefault"}},"containers":[{"name":"oc-backup","image":"alpine:3.20","command":["sleep","3600"],"securityContext":{"allowPrivilegeEscalation":false,"capabilities":{"drop":["ALL"]}},"volumeMounts":[{"name":"data","mountPath":"/data"}]}],"volumes":[{"name":"data","persistentVolumeClaim":{"claimName":"kubernetes-openconsole-data"}}]}}'
kubectl -n $NS wait --for=condition=Ready pod/oc-backup --timeout=120s

kubectl -n $NS exec oc-backup -- sh -c 'rm -rf /data/*'
kubectl -n $NS exec -i oc-backup -- tar xzf - -C /data < "$BACKUP"
kubectl -n $NS exec oc-backup -- ls -la /data

kubectl -n $NS delete pod oc-backup --wait=false
kubectl -n $NS scale deploy/kubernetes-openconsole --replicas=1
kubectl -n $NS rollout status deploy/kubernetes-openconsole --timeout=5m
```

3. **Sign in** with an account from the backup (the passwords are the ones at the time of the backup). The
   clusters, users, roles and audit log are back.

A backup from an older release can be restored into a newer one: the newer version upgrades the database on start
(checked: a 2.21.0 backup restored into 2.22.0). The other way round is not supported ([Upgrading](/installation/upgrading#what-happens-to-the-database)).

If the restored installation reaches the clusters with tokens that were [rotated](/installation/connect-cluster#rotate-the-token)
after the backup, replace them in Admin → Clusters.
