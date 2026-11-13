---
title: "Dashboard"
description: "Namespaces, resource tabs, search, saved views and your cluster."
---

# Dashboard

## Day-to-day use (Dashboard)

- **Namespaces** (left panel): only the ones you have access to, with a filter (`n`). The selection is remembered.
- **Resource tabs**: only the resources you may list. `[` / `]` switch tabs. There are **card** and **list** views; list columns are sortable.
- **Columns** (list view): the ⋮ at the right end of the header row picks which columns show, per tab (*Name* always stays). The choice is kept in the browser (not on the server); *Reset to default* shows them all again. Hiding a column doesn't change what the search finds.
- **Search** (`/`): every space-separated term must match (case-insensitive, part of a word is enough). A plain term matches the name or the text of any column on the tab, hidden ones too, so list and card view find the same rows: Pods status, container names and Controlled By (kind and name); Deployments / StatefulSets / DaemonSets status and replica count (`2/3`); Services type, cluster IP, external IPs and ports (`80`, `8080/TCP`, target port, node port, port name); ConfigMaps / Secrets key names and secret type; Ingresses hosts and paths; CronJobs / Jobs schedule and status; HPAs target (`Deployment/web`) and min / max. Ages, restarts, CPU / memory and fields that aren't columns (node, pod IP, image) are not searched. `label:key=value` or `label:key` match labels.
- **Saved views** (`v`): save the current cluster + namespace + tab + search + view mode under a name. Views are stored on the server, so they follow you to every browser. Opening a view saved on another cluster switches you to that cluster. The share icon makes a view visible to **every user** (marked with its owner); others can use it but only you can rename, unshare or delete it, and admins can remove shared views. A shared view never grants access: someone without permission on its namespace just sees an empty list. Views saved in the browser by older versions are moved to the server the first time you open the menu.
- **Live Events** (`e`): adds, updates, deletes and Kubernetes Events in real time, with filters for warnings.
- **Pods**: logs (live stream), events, **Shell** (`pods:exec`, recorded), YAML.
- **Deployments / StatefulSets**: restart, scale, logs across all pods, YAML edit with server dry-run and a diff before apply.
- **ConfigMaps**: data view; **Secrets**: keys, reveal and edit ([Secrets](/user-guide/secrets)).
- `⌘K` / `Ctrl+K` opens the command palette; `?` lists every shortcut.

## Choosing your cluster

Every user works on **their own** cluster:

- The header switcher (or the `c` key) lists the clusters your permissions cover; admins see all. Picking one switches **only you**, and the choice is remembered across sessions and devices.
- Until you pick one, you work on the **default** cluster, marked "default" in the list. Admins set it under Admin → Clusters → **Set as default**.
- If your cluster is deleted or you lose all permissions on it, you fall back to the default automatically.
- Every audit entry records which cluster the action ran against. Admin → Audit Logs shows it, and the CSV export has a `cluster` column.
