---
title: "Uninstall"
description: "Remove OpenConsole and know what stays behind."
---

# Uninstall

[Back up](/installation/backup-restore) first if you may want the audit log or the settings later.

From the folder with your `kustomization.yaml`:

```bash
kubectl delete -k .
```

An error that `secrets "openconsole-reader-token" not found` is harmless: the Secret went with its ServiceAccount
a moment earlier.

This deletes the namespace `kubernetes-openconsole` and everything in it, plus the cluster-wide ClusterRole
`openconsole-readonly` and its ClusterRoleBinding. Deleting the namespace deletes the PersistentVolumeClaim; with
the usual `Delete` reclaim policy of dynamically provisioned volumes, **the database and recordings are gone**. If
your StorageClass uses `Retain`, the PersistentVolume stays (`kubectl get pv`) until you delete it.

What stays behind:

| What | Where | Remove it with |
|---|---|---|
| The ServiceAccount, its token and the ClusterRole on every **other** cluster you connected | those clusters | `kubectl --context <cluster> delete -f https://raw.githubusercontent.com/vurulkan/kubernetes-openconsole/v2.22.0/deploy/rbac.yaml` then `kubectl --context <cluster> delete namespace kubernetes-openconsole` |
| Your Ingress and its TLS Secret, if you created them outside the kustomization | the namespace (deleted with it) or wherever you put them | `kubectl delete -f ingress.yaml` |
| Audit lines already shipped to your log platform | Elasticsearch, Loki, … | your platform's retention |
| The Elasticsearch pipeline and templates from `deploy/elk/install.sh` | Elasticsearch | [`deploy/elk/README.md` → Remove](https://github.com/vurulkan/kubernetes-openconsole/blob/main/deploy/elk/README.md#remove) |

Deleting the ServiceAccount on a cluster also invalidates its token, so a backup of the database restored
elsewhere can no longer reach that cluster.

For the Docker quick start: `docker rm -f openconsole && docker volume rm openconsole-data`.
