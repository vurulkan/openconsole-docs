---
title: "Try it on k3d"
description: "A local Kubernetes cluster with OpenConsole and pods that fail in every common way, in about ten minutes."
---

# Try it on k3d

A throwaway [k3d](https://k3d.io) cluster (k3s in Docker) with OpenConsole installed the same way as in
production, plus a namespace of workloads that fail on purpose: out of memory, crash loops, a bad image, a failing
init container, an unschedulable pod. About ten minutes, most of it image pulls.

You need Docker, [k3d](https://k3d.io/stable/#installation) and `kubectl`. Every `kubectl` command below names the
cluster's context, so your other clusters are never touched.

## 1. Create the cluster

```bash
k3d cluster create openconsole-demo --kubeconfig-switch-context=false --wait
kubectl --context k3d-openconsole-demo get nodes
```

k3s ships metrics-server, so CPU and memory show up after a minute.

## 2. Install OpenConsole

```bash
kubectl --context k3d-openconsole-demo apply -k \
  'https://github.com/vurulkan/kubernetes-openconsole//deploy?ref=v2.22.0'
kubectl --context k3d-openconsole-demo -n kubernetes-openconsole \
  rollout status deploy/kubernetes-openconsole --timeout=5m
```

This creates the `kubernetes-openconsole` namespace with the app, its volume and Service, and the
`openconsole-reader` ServiceAccount whose token OpenConsole will use to read the cluster. The manifests run the
`:latest` image, the newest release. [Install on Kubernetes](/installation/kubernetes) explains each part and how
to pin the version, which you should do for anything but a demo.

## 3. Add the failing workloads

```bash
kubectl --context k3d-openconsole-demo apply -f \
  https://raw.githubusercontent.com/vurulkan/kubernetes-openconsole/v2.22.0/hack/k3d/crashlab.yaml
```

Namespace `crashlab`: healthy Deployments, StatefulSets and a DaemonSet next to pods that are OOMKilled, crash
looping, failing their liveness probe, stuck on `ImagePullBackOff`, missing a ConfigMap, failing an init container
or unschedulable. Never apply it to a real cluster.

## 4. Open the UI

```bash
kubectl --context k3d-openconsole-demo -n kubernetes-openconsole \
  port-forward svc/kubernetes-openconsole 8080:80
```

Open http://localhost:8080, sign in as `admin` / `admin` and choose a new password.

## 5. Connect the cluster

Read the ServiceAccount's token and CA certificate (in a second terminal):

```bash
NS=kubernetes-openconsole
kubectl --context k3d-openconsole-demo -n $NS get secret openconsole-reader-token \
  -o jsonpath='{.data.token}' | base64 -d; echo
kubectl --context k3d-openconsole-demo -n $NS get secret openconsole-reader-token \
  -o jsonpath='{.data.ca\.crt}'; echo
```

In **Admin → Clusters → Add Cluster**:

| Field | Value |
|---|---|
| Name | `demo` |
| Method | `ServiceAccount Token` |
| API Server | `https://kubernetes.default.svc` (the cluster OpenConsole runs in) |
| Token | the first line printed above |
| CA Cert (base64) | the second line, as it is |

**Save Cluster**, then **Set as default**.

## 6. Look around

| Where | What to look at |
|---|---|
| **Overview** (admins land here) | pods needing attention, restarts, CPU / memory against allocatable, the node strip |
| **Dashboard → `crashlab` → Pods** | the status column as `kubectl` prints it, the last exit code next to the restarts (`137 OOMKilled`), the Containers squares |
| a crashing pod | the drawer: containers, exit codes explained, events; **Logs** → *Before the last restart* |
| a healthy pod | **Shell** (recorded: Admin → Recordings replays it) |
| **Deployments** | restart, scale, revisions, YAML edit with dry-run and diff |
| **Nodes** | the node, its pods, usage |
| **Admin → Audit Logs** | everything you just did, one event each |
| **Admin → Roles / Groups / Users** | create a user with a role that only reads `crashlab`, sign in as them in a private window |

Restart history and usage charts fill in over the next minutes.

## 7. Delete it

```bash
k3d cluster delete openconsole-demo
```

This removes everything, including the database.
