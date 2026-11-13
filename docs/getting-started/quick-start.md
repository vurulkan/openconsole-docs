---
title: "Quick start (Docker)"
sidebar_label: "Quick start"
description: "Run OpenConsole locally with one docker run, sign in and connect a cluster."
---

# Quick start (Docker)

One container on your machine, enough to look around. For a team, [install it on Kubernetes](/installation/kubernetes).

## 1. Start it

```bash
docker run -d --name openconsole -p 8080:8080 \
  -v openconsole-data:/data \
  ghcr.io/vurulkan/kubernetes-openconsole:2.22.0
```

| Part | Meaning |
|---|---|
| `-p 8080:8080` | the UI and API on http://localhost:8080 |
| `-v openconsole-data:/data` | the SQLite database and shell recordings, kept across restarts. Leave it out for a throwaway run |
| `:2.22.0` | the release. Images are `linux/amd64` and `linux/arm64` |

Check that it is up: `curl http://localhost:8080/readyz` answers `ready`.

## 2. Sign in

Open http://localhost:8080 and sign in as **`admin` / `admin`**. You are asked to choose a new password (at least
8 characters, `PASSWORD_MIN_LENGTH`) before anything else works. After the change you are signed out; sign in with
the new password.

## 3. Connect a cluster

OpenConsole never picks up a cluster on its own. You add one in **Admin → Clusters → Add Cluster** with an API
server URL, a ServiceAccount token and its CA certificate. [Connect a cluster](/installation/connect-cluster)
explains how to create that ServiceAccount (step 1: a namespace and one `kubectl apply`) and read its token and CA
(step 2).

The API server must be reachable **from inside the container**. A kubeconfig that points to `127.0.0.1` (Docker
Desktop, kind, k3d) does not work as is: inside the container that address is the container itself.

- For a k3d cluster, run the container on the cluster's network (replace the one from step 1; the data volume
  stays):

  ```bash
  docker rm -f openconsole
  docker run -d --name openconsole --network k3d-<name> -p 8080:8080 \
    -v openconsole-data:/data \
    ghcr.io/vurulkan/kubernetes-openconsole:2.22.0
  ```

  and use `https://k3d-<name>-server-0:6443` as the API server. [Try it on k3d](/getting-started/try-on-k3d) runs
  OpenConsole inside the cluster instead, which is simpler.
- For a remote cluster, use the API server address from your kubeconfig
  (`kubectl config view --minify -o jsonpath='{.clusters[0].cluster.server}'`).

After **Save Cluster** (the connection is checked before it is saved), click **Set as default**. The Dashboard now
shows the cluster's namespaces.

## 4. Stop or remove it

```bash
docker stop openconsole && docker rm openconsole   # keeps the data volume
docker volume rm openconsole-data                  # deletes users, settings, audit log
```
