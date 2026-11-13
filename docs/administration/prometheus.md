---
title: "Prometheus"
description: "Per-cluster Prometheus for longer usage history."
---

# Prometheus

Admin → Clusters → **Prometheus**, one setting per cluster. Without it a cluster's charts use the in-memory samples (24 hours at most). Any Prometheus-compatible query API works: Prometheus, kube-prometheus-stack, Thanos, Mimir, Cortex, VictoriaMetrics, Azure Monitor managed Prometheus.

| Mode | When | What it needs |
|---|---|---|
| **In the cluster (API server proxy)** | Prometheus is only reachable inside the cluster (a ClusterIP Service, the usual kube-prometheus-stack setup) | namespace, Service, port (*Find in cluster* fills them). OpenConsole goes through the Kubernetes API with the cluster's credentials, so no network path or Prometheus password is needed, but the ServiceAccount needs `services/proxy` `get` on that Service: uncomment the rule in `deploy/rbac.yaml` and name only your Service. |
| **Direct URL** | Prometheus has an address OpenConsole can reach (ingress, Thanos / Mimir, managed service) | URL (a path prefix is kept); authentication: none, basic, bearer token, **Azure AD** client credentials (scope `https://prometheus.monitor.azure.com/.default`; for Azure Monitor managed Prometheus), or a client certificate; extra headers (e.g. `X-Scope-OrgID`); CA certificate or skip verification. |

Passwords, tokens, client secrets, client keys and header values are stored encrypted and never returned; the form shows a mask, and saving the mask keeps the stored value. A change is audited as `cluster.update` with `changed: [prometheus]`.

If one Prometheus holds several clusters, set the label that tells them apart (`cluster`, `cluster_name`, …) and this cluster's value; *Test connection* lists the values it finds. Without it the charts add the clusters up.

**Test connection** checks, in order, and stops at the first failure: reachable (DNS / TLS / timeout told apart), allowed in, a Prometheus API, container metrics for this cluster, the cluster filter, and whether cAdvisor is scraped twice (harmless: OpenConsole takes the maximum per container).

Queries use the cAdvisor metrics `container_cpu_usage_seconds_total` and `container_memory_working_set_bytes` (no kube-state-metrics needed; requests and limits come from the pod spec), `max by` container against double scrapes, and a rate window of at least 5 minutes so 60 s scrape intervals work. A deployment's chart includes the pods of its earlier revisions. When Prometheus fails, the chart falls back to the in-memory samples and says so.
