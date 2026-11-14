---
title: "FAQ"
description: "Why one replica, why not Kubernetes RBAC, how it differs from kubectl, and where the data is."
---

# FAQ

## Why exactly one replica?

The database is one SQLite file on a ReadWriteOnce volume. A second pod would either not start (the volume is
attached elsewhere) or open the same file at the same time, which loses or corrupts writes. One pod serves a large
team: lists come from an in-memory cache of each cluster, not from the API server. Use `strategy: Recreate` so an
upgrade never runs two pods at once ([Install on Kubernetes](/installation/kubernetes#why-exactly-one-replica)).

## Why its own permissions instead of Kubernetes RBAC?

OpenConsole connects to each cluster with one identity and grants people actions per namespace and per cluster
inside the app. That lets you give someone `pods:logs` in one namespace on one cluster without creating a
Kubernetes user, a kubeconfig or a RoleBinding in every cluster; it works the same for local, LDAP and Azure AD
accounts and for API keys; and every action lands in one audit log with the person's name. The connected identity's
ClusterRole stays the upper bound for everyone ([Security model](/operations/security#who-may-do-what)).

## How is it different from kubectl?

kubectl gives each person their own credentials and the whole API. OpenConsole gives people a fixed set of actions
(see, logs, shell, restart, scale, edit YAML, reveal a Secret) through a browser or an API key, without handing out
cluster credentials, and records every one of them. It doesn't create or delete objects, and it doesn't replace
kubectl, Helm or GitOps for deploying.

## Where is the data?

All of it is on the OpenConsole volume: `/data/app.db` (users, roles, clusters and their encrypted credentials,
settings, sessions, API key digests, the audit log for `LOG_RETENTION_DAYS`) and `/data/recordings` (shell
recordings). Nothing is sent anywhere else, except what you configure: logs on stdout for your log platform,
`/metrics` for Prometheus, traces to your OTLP receiver ([Backup and restore](/installation/backup-restore)).

## Does it change anything in my clusters?

Only when a user with the permission restarts, scales, applies YAML or opens a shell. Restart and scale go through
the usual Deployment / StatefulSet fields; YAML apply is an update of the object (a dry-run first, if the user asks).
It installs no agents or CRDs; the only objects it needs are the ServiceAccount and ClusterRole you apply.

## Who can see Secrets?

Nobody by default except admins. Listing Secrets shows names, types and key names; a value is shown only with
`secrets:reveal`, one key at a time, each one audited ([Secrets](/user-guide/secrets)).
