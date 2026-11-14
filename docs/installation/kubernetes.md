---
title: "Install on Kubernetes"
description: "Deploy OpenConsole with kustomize: pinned version, one replica, volume, Service, Ingress with TLS."
---

# Install on Kubernetes

OpenConsole is one Deployment with one pod, a 5 GiB volume and a ClusterIP Service. The manifests are in the
[`deploy/`](https://github.com/vurulkan/kubernetes-openconsole/tree/main/deploy) folder of the code repository;
you apply them with kustomize, which is built into `kubectl`.

## 1. Write a kustomization

Create a folder (keep it in Git) with this `kustomization.yaml`:

```yaml title="kustomization.yaml"
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
resources:
  # the manifests of one release
  - https://github.com/vurulkan/kubernetes-openconsole//deploy?ref=v2.22.0
images:
  # the image of the same release
  - name: ghcr.io/vurulkan/kubernetes-openconsole
    newTag: "2.22.0"
patches:
  - patch: |-
      apiVersion: apps/v1
      kind: Deployment
      metadata:
        name: kubernetes-openconsole
        namespace: kubernetes-openconsole
      spec:
        # Stop the old pod before the new one starts: SQLite must never be
        # opened by two pods at once (upgrades, rollout restart).
        strategy:
          type: Recreate
          rollingUpdate: null
        template:
          spec:
            containers:
              - name: dashboard
                imagePullPolicy: IfNotPresent
                env:
                  # the time zone of audit timestamps in the UI (the manifest says Europe/Istanbul)
                  - name: TIMEZONE
                    value: UTC
```

- The `?ref=` resource is fetched with `git`, so the machine running `kubectl` needs `git` and access to GitHub.
- **Pin the release** in both places (`ref=v2.22.0` and `newTag`). Without the `images:` override the manifest runs
  `:latest`, and a pod restart could then upgrade you without notice.
- **`Recreate`** is important. With the default rolling update the new pod starts while the old one still holds
  the database; on 2.22.0 that can lose the writes made after the overlap until the next restart. Upgrades and
  `rollout restart` then have a few seconds of downtime while the new pod starts.
- Add other variables to the same `env:` list (see [below](#settings-you-may-want-to-change)).

## 2. Apply it

```bash
kubectl apply -k .
kubectl -n kubernetes-openconsole rollout status deploy/kubernetes-openconsole --timeout=5m
```

What gets created, all in namespace `kubernetes-openconsole`:

| Object | What |
|---|---|
| Namespace `kubernetes-openconsole` | |
| Deployment `kubernetes-openconsole` | 1 replica, non-root (uid 65532), `seccompProfile: RuntimeDefault`, all capabilities dropped, **no ServiceAccount token mounted**: the app never uses the pod's own identity. Probes on `/livez` and `/readyz` |
| PersistentVolumeClaim `kubernetes-openconsole-data` | 5 GiB, ReadWriteOnce, the cluster's default StorageClass, mounted at `/data`: the SQLite database `app.db` and shell recordings |
| Service `kubernetes-openconsole` | ClusterIP, port 80 → container port 8080 |
| ServiceAccount `openconsole-reader`, Secret `openconsole-reader-token` | the identity OpenConsole reads this cluster with: you paste its token into the UI ([Connect a cluster](/installation/connect-cluster)) |
| ClusterRole `openconsole-readonly` + ClusterRoleBinding | what that identity may do (despite the name, it includes the write verbs; see [Connect a cluster](/installation/connect-cluster#what-each-clusterrole-rule-is-for)) |

To install without the ServiceAccount and ClusterRole (you connect every cluster with a kubeconfig of your own), list
the files instead of the folder:

```yaml
resources:
  - https://raw.githubusercontent.com/vurulkan/kubernetes-openconsole/v2.22.0/deploy/namespace.yaml
  - https://raw.githubusercontent.com/vurulkan/kubernetes-openconsole/v2.22.0/deploy/pvc.yaml
  - https://raw.githubusercontent.com/vurulkan/kubernetes-openconsole/v2.22.0/deploy/service.yaml
  - https://raw.githubusercontent.com/vurulkan/kubernetes-openconsole/v2.22.0/deploy/deployment.yaml
```

## Why exactly one replica

The database is a SQLite file on a ReadWriteOnce volume. A second pod would either not start (the volume is
attached to another node) or open the same file next to the first one, which loses or corrupts writes. Don't
scale the Deployment and don't add an HPA. One pod serves a large team: lists come from an in-memory cache, not
from the API server.

## Resources

The manifest requests `300m` CPU and `384Mi` memory and limits them to `1` CPU and `1Gi`. Memory grows with the
number of pods, Deployments, Services, … in the connected clusters, since OpenConsole keeps them in memory, plus
about 10 KB per pod for 24 hours of usage samples. If the pod is OOMKilled, raise the memory limit first.

The volume holds the database (small: users, roles, the audit log for `LOG_RETENTION_DAYS`) and shell recordings,
which are capped at 2 GiB by default (Admin → Recordings). 5 GiB is enough for most installations.

## Settings you may want to change

Everything else is configured in the UI and stored in the database. These are read from the environment on start:

| Variable | Default | Meaning |
|---|---|---|
| `TIMEZONE` | `UTC` (the manifest sets `Europe/Istanbul`) | time zone of audit timestamps in the UI; stored times are UTC |
| `LOG_RETENTION_DAYS` | `30` | days audit events are kept in the database (`0` or an invalid value means the default, 30) |
| `RESTART_HISTORY_RETENTION_DAYS` | `30` | container exits kept for the restart history |
| `API_KEY_READ_RETENTION_DAYS` | `7` | successful reads made with an API key |
| `APP_ENV` | (the manifest sets `prod`) | environment label on every log line and trace |
| `LOG_FORMAT` | `text` (the manifest sets `ecs`) | `ecs` for Elastic, `json`, or `text` |
| `DATA_PATH` | `/data/app.db` | the database file; must be on the volume |

The full list, including feature flags and limits: [Environment variables](/reference/environment-variables).

## Ingress with TLS

The Service is ClusterIP; put your Ingress or Gateway in front of it. OpenConsole needs nothing special from it
except WebSockets (logs, shell, live events), which every common controller passes through. Example for a
certificate in a Secret (or let cert-manager create it):

```yaml title="ingress.yaml"
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: kubernetes-openconsole
  namespace: kubernetes-openconsole
spec:
  ingressClassName: nginx            # your Ingress class
  tls:
    - hosts: [openconsole.example.com]
      secretName: openconsole-tls    # kubernetes.io/tls Secret in this namespace
  rules:
    - host: openconsole.example.com
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: kubernetes-openconsole
                port:
                  name: http
```

```bash
kubectl -n kubernetes-openconsole create secret tls openconsole-tls --cert=tls.crt --key=tls.key
kubectl apply -f ingress.yaml
```

**ingress-nginx closes idle WebSockets after 60 seconds**, which ends a pod shell that waits for input and a log
stream of a quiet container. Raise its timeouts on this Ingress:

```yaml
metadata:
  annotations:
    nginx.ingress.kubernetes.io/proxy-read-timeout: "3600"
    nginx.ingress.kubernetes.io/proxy-send-timeout: "3600"
```

Other proxies have the same kind of idle timeout (e.g. an Azure Application Gateway or AWS load balancer in front
of the Ingress); set it above the shell idle timeout, `EXEC_IDLE_TIMEOUT` (5 minutes).

Don't route `/metrics` from outside: it is unauthenticated, for your Prometheus inside the cluster
([Metrics](/operations/metrics)).

## Next

1. [Connect a cluster](/installation/connect-cluster): this one (the ServiceAccount is already there) and any others.
2. [First login](/getting-started/first-login): change the admin password, set up users and roles.
3. [Back up](/installation/backup-restore) the volume before your first [upgrade](/installation/upgrading).
