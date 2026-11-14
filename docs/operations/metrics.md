---
title: "Metrics and alerts"
sidebar_label: "Metrics"
description: "Scrape /metrics with a ServiceMonitor or pod annotations, and the alerts worth having."
---

# Metrics and alerts

OpenConsole serves Prometheus metrics at `GET /metrics` on its HTTP port (8080 in the pod, port `http` of the
Service). The endpoint has no sign-in: scrape it from inside the cluster and don't route it through your Ingress.
Every metric, its type and labels: [Metrics reference](/reference/metrics).

```bash
kubectl -n kubernetes-openconsole port-forward svc/kubernetes-openconsole 8080:80 &
curl -s localhost:8080/metrics | grep -v '^#'
```

```text
openconsole_http_requests_total 15
openconsole_http_requests_status_total{status="2xx"} 15
openconsole_http_request_duration_ms_sum 1026
openconsole_http_request_duration_ms_count 15
openconsole_audit_events_total 4
openconsole_pod_exec_sessions_total 0
openconsole_pod_log_streams_total 0
openconsole_deployment_actions_total 0
openconsole_pod_exec_active 0
openconsole_cluster_requests_total{cluster="demo"} 3
openconsole_cluster_connected{cluster="demo"} 1
```

The counters live in memory and start from zero when the pod restarts; `rate()` and `increase()` handle that.

## Scrape with the Prometheus Operator

With kube-prometheus-stack or another Prometheus Operator setup, add a ServiceMonitor. The Service in `deploy/` has
no labels, and a ServiceMonitor selects Services by label, so give it one in the same kustomization
([Install on Kubernetes](/installation/kubernetes)):

```yaml title="kustomization.yaml (additions)"
resources:
  - servicemonitor.yaml
patches:
  # The Service has no labels; a ServiceMonitor selects Services by label.
  - patch: |-
      apiVersion: v1
      kind: Service
      metadata:
        name: kubernetes-openconsole
        namespace: kubernetes-openconsole
        labels:
          app: kubernetes-openconsole
```

```yaml title="servicemonitor.yaml"
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: kubernetes-openconsole
  namespace: kubernetes-openconsole
  labels:
    release: kube-prometheus-stack   # the label your Prometheus selects ServiceMonitors by
spec:
  selector:
    matchLabels:
      app: kubernetes-openconsole
  endpoints:
    - port: http
      path: /metrics
      interval: 30s
```

`release: kube-prometheus-stack` is what a kube-prometheus-stack installed under that release name selects; check
yours with `kubectl get prometheus -A -o jsonpath='{..serviceMonitorSelector}'`. The Prometheus also needs to watch
the `kubernetes-openconsole` namespace (`serviceMonitorNamespaceSelector`; kube-prometheus-stack watches all
namespaces by default). The target then shows up as job `kubernetes-openconsole`:

```bash
kubectl apply -k .
# Prometheus → Status → Targets, or ask it (prometheus-operated is the operator's Service for it):
kubectl -n monitoring port-forward svc/prometheus-operated 9090 &
curl -s 'localhost:9090/api/v1/query?query=openconsole_cluster_connected'
```

```json
{"__name__":"openconsole_cluster_connected","cluster":"demo","container":"dashboard","endpoint":"http",
 "instance":"10.42.0.33:8080","job":"kubernetes-openconsole","namespace":"kubernetes-openconsole",
 "pod":"kubernetes-openconsole-856cdc7c49-t5rbf","service":"kubernetes-openconsole"} 1
```

## Scrape with pod annotations

A Prometheus with the usual "scrape pods that ask for it" job (the `kubernetes-pods` job of the
prometheus-community Helm chart, and many hand-written configs) picks the pod up from three annotations:

```yaml title="kustomization.yaml (addition)"
patches:
  - patch: |-
      apiVersion: apps/v1
      kind: Deployment
      metadata:
        name: kubernetes-openconsole
        namespace: kubernetes-openconsole
      spec:
        template:
          metadata:
            annotations:
              prometheus.io/scrape: "true"
              prometheus.io/port: "8080"
              prometheus.io/path: /metrics
```

If your Prometheus has no such job, this is the one the annotations work with:

```yaml title="prometheus.yml"
scrape_configs:
  - job_name: kubernetes-pods
    kubernetes_sd_configs:
      - role: pod
    relabel_configs:
      - source_labels: [__meta_kubernetes_pod_annotation_prometheus_io_scrape]
        action: keep
        regex: "true"
      - source_labels: [__meta_kubernetes_pod_annotation_prometheus_io_path]
        action: replace
        target_label: __metrics_path__
        regex: (.+)
      - source_labels: [__address__, __meta_kubernetes_pod_annotation_prometheus_io_port]
        action: replace
        regex: ([^:]+)(?::\d+)?;(\d+)
        replacement: $1:$2
        target_label: __address__
      - source_labels: [__meta_kubernetes_namespace]
        target_label: namespace
      - source_labels: [__meta_kubernetes_pod_name]
        target_label: pod
```

The pod annotation changes the pod template, so applying it restarts OpenConsole once.

## What to watch

| Metric | What it tells you |
|---|---|
| `up` of the OpenConsole target | the pod answers |
| `openconsole_cluster_connected{cluster}` | `1` when OpenConsole has opened its connection to the cluster. Connections are opened at start and when a cluster is first used, so a cluster added since the last restart shows `0` until someone selects it. The value doesn't follow the cluster's credentials afterwards: a revoked token shows up as 5xx answers and `failed to list … Unauthorized` lines in the [log](/operations/troubleshooting#a-cluster-shows-empty-lists-or-503) |
| `openconsole_http_requests_status_total{status="5xx"}` | answers with an error: a cluster that refuses OpenConsole, a database problem |
| `openconsole_http_request_duration_ms_sum` / `_count` | average request time |
| `openconsole_pod_exec_active` | shells open right now |
| `openconsole_cluster_requests_total{cluster}` | which clusters people use |

## Alerts

A PrometheusRule for the Prometheus Operator (for a plain Prometheus, the `groups:` part goes into a rules file):

```yaml title="prometheusrule.yaml"
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: kubernetes-openconsole
  namespace: kubernetes-openconsole
  labels:
    release: kube-prometheus-stack   # the label your Prometheus selects rules by
spec:
  groups:
    - name: openconsole
      rules:
        - alert: OpenConsoleDown
          expr: up{job="kubernetes-openconsole"} == 0 or absent(up{job="kubernetes-openconsole"})
          for: 5m
          labels: {severity: critical}
          annotations:
            summary: OpenConsole is not answering its /metrics scrape.
        - alert: OpenConsoleClusterNotConnected
          expr: openconsole_cluster_connected == 0
          for: 15m
          labels: {severity: warning}
          annotations:
            summary: "OpenConsole has no connection to cluster {{ $labels.cluster }}."
        - alert: OpenConsoleServerErrors
          expr: increase(openconsole_http_requests_status_total{status="5xx"}[10m]) > 10
          labels: {severity: warning}
          annotations:
            summary: "OpenConsole answered {{ $value | printf \"%.0f\" }} requests with 5xx in 10 minutes."
        - alert: OpenConsoleSlowRequests
          expr: |
            rate(openconsole_http_request_duration_ms_sum[10m])
              / rate(openconsole_http_request_duration_ms_count[10m]) > 1000
          for: 10m
          labels: {severity: warning}
          annotations:
            summary: OpenConsole requests take more than 1 s on average.
```

The `job` label is the ServiceMonitor's; with pod annotations use `job="kubernetes-pods"`. A cluster nobody has
used since it was added keeps `OpenConsoleClusterNotConnected` pending; select it once, or restart OpenConsole,
after adding a cluster.

Some things are audit events, not metrics. Alert on them in your log platform
([Elastic](/operations/elastic#questions-the-audit-log-answers)), e.g. as a Kibana rule on the audit data view:

| Alert | Query (`logs-openconsole.audit-*`) |
|---|---|
| A sign-in was locked after 5 wrong passwords | `openconsole.outcome : "locked"` |
| Someone hit the shell limit | `event.action : "pod.exec" and openconsole.outcome : "rate_limited"` |
| A secret was revealed | `event.action : "secret.reveal" and event.outcome : "success"` |
| Repeated refusals for one user | `openconsole.outcome : "denied"`, grouped by `user.name` |
