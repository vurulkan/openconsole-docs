---
title: "Application permissions"
description: "Every resource and action a role can grant."
---

# Application permissions

Granted per role, per namespace, per cluster (or all clusters) under **Admin → Roles**. Admins implicitly have everything.

| Resource | Actions |
|---|---|
| pods | `list`, `get`, `logs`, `exec`, `edit` |
| deployments | `list`, `get`, `restart`, `scale`, `edit` |
| daemonsets, hpas, services, configmaps, ingresses, cronjobs, jobs | `list`, `get`, `edit` |
| statefulsets | `list`, `get`, `scale`, `edit` |
| secrets | `list`, `get`, `reveal`, `edit` |

Templates in the Add Permissions modal: Viewer (read only, including secret *metadata*), Developer (+ restart / scale), SRE (+ edit on common workloads, pod exec), Admin (everything, including `secrets:reveal` and `secrets:edit`). Any of these can also be granted one by one to any role, so regular users can be given secret access per namespace without being admins.
