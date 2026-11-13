---
title: "Restart, scale and YAML edit"
sidebar_label: "Workload actions"
description: "Deployment restart, Deployment / StatefulSet scale and YAML apply."
---

# Restart, scale and YAML edit

OpenConsole can restart, scale, and apply YAML to workloads when the caller has been granted the matching application-level permissions:

| Permission                   | Endpoint                                                                 |
|------------------------------|--------------------------------------------------------------------------|
| `deployments:restart`        | `POST /api/namespaces/{ns}/deployments/{name}/restart`                   |
| `deployments:scale`          | `POST /api/namespaces/{ns}/deployments/{name}/scale` body `{"replicas"}` |
| `statefulsets:scale`         | `POST /api/namespaces/{ns}/statefulsets/{name}/scale` body `{"replicas"}` |
| `{resource}:edit`            | `POST /api/namespaces/{ns}/{resource}/{name}/apply` body `{"yaml","dryRun"}` |

The `edit` action covers Pod, Deployment, DaemonSet, StatefulSet, HPA, Service, ConfigMap, Ingress, CronJob, Job — same handler for all, powered by the `dynamic` client with GVK fallback and server-side `DryRun=All`.

- Every call records an audit event (`deployment.restart`, `deployment.scale`, `statefulset.scale`, `<kind>.apply`) with outcome `success`, `denied`, `rate_limited` or `failed`. Restart records `restarted_at`, scale `replicas_from` / `replicas_to`, apply `dry_run` and the `yaml_from` / `yaml_to` hashes; a failure has a `reason` (`k8s_forbidden`, `not_found`, `conflict`, `invalid`, …) and the `error`.
- Per-user rate limit: 5 burst, 1 token every 6 s. 429 with `Retry-After` when exceeded.
- Scale accepts replicas between 0 and `MAX_REPLICAS` (env, default 100).
- YAML apply enforces optimistic concurrency via `metadata.resourceVersion` — a stale edit returns 409.
- Error mapping: the API server's `apierrors` reason maps to the right HTTP status (NotFound → 404, Conflict → 409, Invalid → 400, Timeout → 504) so a reverse proxy / Cloudflare doesn't wrap a 5xx around a 4xx issue.

Request / audit correlation: every HTTP response carries `X-Request-Id`; the same id appears in the structured request log and in the audit mirror.
