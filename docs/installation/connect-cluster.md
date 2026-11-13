---
title: "Connect a cluster"
description: "ServiceAccount, ClusterRole, token or kubeconfig, token rotation."
---

# Connect a cluster

OpenConsole talks to each cluster as one ServiceAccount and enforces per-user access itself (Users → Groups → Roles). The ServiceAccount's ClusterRole is the ceiling: no user can do more than it allows, whatever their role says.

Clusters are added **only in the UI** (Admin → Clusters). Two methods: **ServiceAccount Token** (API server URL + token + CA) or **Kubeconfig** (upload a file). Credentials are validated against the API server before they are saved (a real namespace list call, so a wrong server, token or CA is rejected) and stored encrypted in SQLite. Each user works on the cluster they pick in the header; see [Choosing your cluster](/user-guide/dashboard#choosing-your-cluster). Every cluster is connected at startup, so pod usage and restart history are recorded from then on.

## 1. Create the ServiceAccount on the cluster

This step is for the **ServiceAccount Token** method, and for a kubeconfig built from that token (3b). If you connect with a kubeconfig whose identity you already manage, skip it. That identity's RBAC then has to cover what OpenConsole should do; the table below shows what each rule enables.

The OpenConsole pod does **not** run as this ServiceAccount. `deployment.yaml` sets no `serviceAccountName` and turns off token automount, because the app only ever uses the credentials stored in Admin → Clusters. The ServiceAccount exists to mint the token you paste into the UI.

Do this on every cluster you will connect with a token, including the one OpenConsole runs in. `deploy/rbac.yaml` creates:

- ServiceAccount `openconsole-reader` (namespace `kubernetes-openconsole`)
- Secret `openconsole-reader-token`: a long-lived token; Kubernetes fills in `token` and `ca.crt`
- ClusterRole `openconsole-readonly` and a binding to the ServiceAccount

For the cluster OpenConsole runs in, `kubectl apply -k deploy/` already did this. For a remote cluster:

```bash
kubectl --context <remote> create namespace kubernetes-openconsole
kubectl --context <remote> apply -f deploy/rbac.yaml
```

What the ClusterRole allows, and which application permission needs it. Delete the rules for permissions you will never grant:

| ClusterRole rule | Needed for |
|---|---|
| `namespaces, pods, services, configmaps, events`: get / list / watch | every Dashboard tab, Live Events |
| `secrets`: get / list | `secrets:list`, `secrets:get`, `secrets:reveal` |
| `secrets`: update | `secrets:edit` |
| `pods/log`: get | `pods:logs`, deployment / job logs |
| `pods/exec`: create | `pods:exec` (shell) |
| `pods, services, configmaps`: update | `{resource}:edit` (YAML apply) |
| `deployments, daemonsets, statefulsets`: get / list / watch / update | tabs + `edit` |
| `deployments`: patch | `deployments:restart` |
| `deployments/scale, statefulsets/scale`: get / update | `deployments:scale`, `statefulsets:scale` |
| `horizontalpodautoscalers, ingresses, cronjobs, jobs`: get / list / watch / update | tabs + `edit` |
| `replicasets`: get / list | deployment revisions in the detail drawer |
| `metrics.k8s.io` `pods`: get / list | CPU / memory (needs metrics-server in the cluster) |
| `nodes`: get / list / watch, `metrics.k8s.io` `nodes`: get / list | Overview (node count, CPU / memory as % of allocatable, node strip) and Nodes. Without them the overview still works, with absolute CPU / memory and no node strip, and Nodes says the token can't list nodes. Without `watch` (ClusterRole from 2.19 or older) nodes are listed on each request instead of read from the cache |
| `services/proxy`: get on your Prometheus Service (commented out; optional) | Prometheus "in the cluster" mode |

### Read-only mode

To run OpenConsole purely as a viewer, use `deploy/rbac-readonly.yaml` instead of `deploy/rbac.yaml`. It defines the same ServiceAccount, token and binding names, with a ClusterRole that has only `get` / `list` / `watch`.

```bash
kubectl apply -f deploy/rbac-readonly.yaml          # instead of rbac.yaml
# with kustomize: replace rbac.yaml with rbac-readonly.yaml in deploy/kustomization.yaml
```

| | Works | Refused by Kubernetes (403) |
|---|---|---|
| `rbac-readonly.yaml` | every Dashboard tab, Live Events, pod / deployment / job logs | restart, scale, YAML apply, pod shell. Secrets are not included at all |

- The Kubernetes RBAC is the hard limit. Even if an OpenConsole role grants `edit` or `exec`, the API server refuses the call. Still, leave write actions out of your OpenConsole roles too, so users don't see buttons that only fail.
- Logs are included. Drop the `pods/log` rule if read-only should also mean "no logs".
- Secrets are excluded on purpose. At the Kubernetes level `get` on secrets means reading values, so enabling the commented rule makes OpenConsole's `secrets:reveal` permission the only protection. If you only need secret metadata, uncomment it and grant `secrets:list` / `secrets:get` only.
- With the **Kubeconfig** method the same rule applies: OpenConsole can do exactly what the kubeconfig's identity can. A kubeconfig built from this ServiceAccount's token (step 3b) gives you a read-only console. So does a kubeconfig for any identity of your own that only has get / list / watch, without applying either rbac file.
- To go back to full access, apply `deploy/rbac.yaml`. `kubectl apply` replaces the rule list in place; nothing needs to change in the UI.

## 2. Read the token and CA

Run this against the cluster you are adding:

```bash
NS=kubernetes-openconsole
TOKEN=$(kubectl -n $NS get secret openconsole-reader-token -o jsonpath='{.data.token}' | base64 -d)
CA=$(kubectl -n $NS get secret openconsole-reader-token -o jsonpath='{.data.ca\.crt}')   # already base64 — use as-is
SERVER=$(kubectl config view --minify -o jsonpath='{.clusters[0].cluster.server}')
```

`SERVER` must be reachable **from the OpenConsole pod**. For the cluster OpenConsole runs in, use `https://kubernetes.default.svc`.

## 3a. Add it with the ServiceAccount Token method

**Admin → Clusters → Add Cluster**:

| Field | Value |
|---|---|
| Name | anything, e.g. `prod-west` |
| Method | `ServiceAccount Token` |
| API Server | `$SERVER` (or `https://kubernetes.default.svc` for the local cluster) |
| Token | `$TOKEN` |
| CA Cert (base64) | `$CA`. Leave it empty only if the API server certificate is signed by a public CA. |

**Save Cluster** validates the connection. Then click **Set as default** on the cluster card. Users who haven't picked a cluster work on the default; everyone can switch to another cluster their permissions cover.

## 3b. Or with the Kubeconfig method

Upload a kubeconfig under **Method: Kubeconfig → Upload kubeconfig**. It can be any kubeconfig whose identity uses a static token or client certificate, with the RBAC you want (in that case step 1 is not needed). Or build one from the ServiceAccount token above:

```bash
cat > openconsole-prod-west.kubeconfig <<EOF
apiVersion: v1
kind: Config
clusters:
- name: target
  cluster:
    server: ${SERVER}
    certificate-authority-data: ${CA}
users:
- name: openconsole-reader
  user:
    token: ${TOKEN}
contexts:
- name: openconsole
  context:
    cluster: target
    user: openconsole-reader
current-context: openconsole
EOF
```

> Don't upload your personal kubeconfig. Kubeconfigs that authenticate through an exec plugin (`kubelogin`, `aws eks get-token`, `gke-gcloud-auth-plugin`) don't work: the container has none of those binaries. They would also make OpenConsole act as you instead of as the ServiceAccount.

## Token rotation

```bash
kubectl -n kubernetes-openconsole delete secret openconsole-reader-token
kubectl apply -f deploy/rbac.yaml   # Kubernetes issues a new token
```

Then edit the cluster in Admin → Clusters, tick **Replace credentials** and paste the new token (or upload the new kubeconfig). The old token stops working as soon as its Secret is deleted.

If you would rather use an expiring token: `kubectl -n kubernetes-openconsole create token openconsole-reader --duration=8760h`. You must replace it in the UI before it expires.

## Troubleshooting

- **Validation fails on Save**: the API server is not reachable from the pod (network policy, private endpoint), or the CA does not match.
- **Secrets tab: "ServiceAccount is not allowed to read secrets"**: the ClusterRole lacks the `secrets` rule. Re-apply `deploy/rbac.yaml`.
- **A tab is empty or 403 for a user**: check that user's role permissions first, then the ClusterRole rule in the table above.
- **No CPU / memory columns**: the cluster has no metrics-server (`kubectl get apiservices v1beta1.metrics.k8s.io`), or the ClusterRole lacks `metrics.k8s.io` `pods`. The Pods tab says which.
- **Prometheus test fails**: the test names the failing step; see [Prometheus](/administration/prometheus).
