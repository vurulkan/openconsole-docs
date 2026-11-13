---
title: "Metrics and health"
sidebar_label: "Metrics"
description: "Prometheus /metrics and the health endpoints."
---

# Metrics and health

`GET /metrics` (Prometheus text format, unauthenticated — scrape it from inside the cluster; don't expose it through your Ingress):

| Metric | Meaning |
|---|---|
| `openconsole_http_requests_total`, `openconsole_http_requests_status_total{code}` | API requests, by status class |
| `openconsole_http_request_duration_ms_sum` / `_count` | request latency |
| `openconsole_cluster_requests_total{cluster}` | authenticated API requests per cluster |
| `openconsole_cluster_connected{cluster}` | 1 while OpenConsole holds a working connection to that cluster |
| `openconsole_pod_exec_sessions_total`, `openconsole_pod_exec_active` | pod shells started / open right now |
| `openconsole_pod_log_streams_total` | log streams opened |
| `openconsole_deployment_actions_total` | restart / scale actions |
| `openconsole_audit_events_total` | audit entries written |
