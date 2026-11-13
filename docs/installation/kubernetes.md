---
title: "Install on Kubernetes"
description: "Deploy OpenConsole with kubectl apply -k deploy/."
---

# Install on Kubernetes

```bash
kubectl apply -k deploy/
```

This installs, in namespace `kubernetes-openconsole`:

| File | What |
|---|---|
| `namespace.yaml` | the namespace |
| `rbac.yaml` | ServiceAccount `openconsole-reader`, its long-lived token Secret, ClusterRole `openconsole-readonly` + binding. It produces the token you paste into the UI; see [Connecting clusters](/installation/connect-cluster). `rbac-readonly.yaml` is the [read-only](/installation/connect-cluster#read-only-mode) alternative. Not needed if you connect with your own kubeconfig identity |
| `pvc.yaml` | 5 Gi PVC for `/data` (SQLite + session recordings); a commented second PVC for recordings |
| `service.yaml` | ClusterIP Service on port 80 → container 8080 (put your Ingress / Gateway in front) |
| `elk/` | Optional, not applied by kustomize: Elasticsearch ingest pipeline, mappings and installer for the logs ([deploy/elk/README.md](https://github.com/vurulkan/kubernetes-openconsole/blob/main/deploy/elk/README.md)) |
| `deployment.yaml` | 1 replica (SQLite on a RWO volume — do not scale out), `:latest` image with `imagePullPolicy: Always`, every env var documented inline, requests / limits, `/livez` + `/readyz` probes, non-root, `seccompProfile: RuntimeDefault`, and **no ServiceAccount token mounted** (`automountServiceAccountToken: false`). The app never uses the pod's own identity |

Then:

1. Open the UI and log in as `admin` / `admin` ([First login](/getting-started/first-login)).
2. Add the cluster in **Admin → Clusters** ([Connecting clusters](/installation/connect-cluster)). The backend never picks up a cluster on its own.

To upgrade, run `kubectl -n kubernetes-openconsole rollout restart deploy/kubernetes-openconsole`. The pod pulls `:latest`, i.e. the newest release. To stay on a fixed version, set a release tag (e.g. `2.22.0`) in `deployment.yaml` or through the `images:` override in `kustomization.yaml`, then re-apply.
