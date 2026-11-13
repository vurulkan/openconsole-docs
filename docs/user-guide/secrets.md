---
title: "Secrets"
description: "List, inspect, reveal and edit Secrets with separate permissions."
---

# Secrets

The Secrets tab (after ConfigMaps) uses four permissions. Seeing that a secret exists, reading a value and changing it are separate grants. Admins have all four; give them to other users per namespace through their roles (Admin → Roles).

| Permission | Returns |
|---|---|
| `secrets:list` | name, type, key count, age |
| `secrets:get` | the **Keys** modal: type, immutable flag, labels, annotations, key names and sizes |
| `secrets:reveal` | **Show** on a key: that one key's value, plus copy / hide buttons |
| `secrets:edit` | the **YAML** button: the same editor as other resources (read-only view → Edit → Dry-run → diff → Apply) |

- Values never leave the server on `list` / `get`. The `kubectl.kubernetes.io/last-applied-configuration` annotation, which embeds the data, is dropped too.
- `reveal` is a POST for a single key, sent with `Cache-Control: no-store`. Binary values come back base64-encoded and labelled as such. Revealed values are discarded when the modal closes.
- Every reveal is audited as `secret.reveal` (success / denied / failed) with the namespace, secret and the key name in `key` (never the value).
- **Editing (`secrets:edit`)**: the YAML shows text values as plain-text `stringData`, so you edit readable values instead of base64. Binary values stay base64 in `data`. On apply Kubernetes merges `stringData` into `data`. Removing a key from the YAML deletes it. The dry-run result comes back in the same shape, so the before / after diff compares like with like.
- The YAML holds every value, so opening it requires `secrets:edit`; `get` or `reveal` is not enough. Each open is audited as `secret.view_yaml`, and changes as `secret.apply`, the same as other resources. Optimistic concurrency applies too: a stale `resourceVersion` gives a 409.
- Secrets are not held in the informer cache. Each request reads from the API server, so no secret values sit in OpenConsole's memory.
- Needs the `secrets` rule in the ClusterRole: get / list, plus `update` for `secrets:edit`.
