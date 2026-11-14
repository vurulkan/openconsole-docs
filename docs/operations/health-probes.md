---
title: "Health probes"
description: "/livez, /readyz and /healthz: what each one checks, and why the connected clusters are not part of readiness."
---

# Health probes

Three endpoints on the HTTP port, without sign-in:

| Endpoint | Checks | Answer |
|---|---|---|
| `GET /livez` | the process accepts requests | `200 live` |
| `GET /readyz` | the database answers | `200 ready`, or `503 db not reachable` |
| `GET /healthz` | the same as `/livez` (kept for older probes) | `200 ok` |

```bash
kubectl -n kubernetes-openconsole port-forward svc/kubernetes-openconsole 8080:80 &
curl -s localhost:8080/livez; echo; curl -s localhost:8080/readyz; echo
# live
# ready
```

The manifest in `deploy/` uses them like this (and you shouldn't need to change it):

| Probe | Path | Timing |
|---|---|---|
| liveness | `/livez` | after 10 s, every 15 s, 3 s timeout, restart after 3 failures |
| readiness | `/readyz` | after 5 s, every 10 s, 3 s timeout, out of the Service after 3 failures |

## Why the clusters are not part of readiness

OpenConsole connects to several clusters, each with its own credentials. If readiness depended on them, one
unreachable cluster, or one expired token, would take the whole console out of its Service: nobody could sign in,
including the admin who has to fix that cluster's credentials. So readiness only checks what every request needs,
the database. A cluster's state shows where it belongs: the cluster's own requests answer with an error, its
connection gauge is `openconsole_cluster_connected` ([Metrics](/operations/metrics)), and its client errors are in
the log ([Troubleshooting](/operations/troubleshooting#a-cluster-shows-empty-lists-or-503)).

Liveness doesn't check the database either, so a short database hiccup doesn't restart the pod.

## Logging

Successful probe and `/metrics` requests are logged only at `LOG_LEVEL=debug`, so the kubelet's probes every 10–15
seconds don't fill the log. A failing probe keeps its level: `/readyz` answering 503 is an `error` line.
Probes and `/metrics` are not traced.
