---
title: "Quick start"
description: "Create an API key and make the first calls with curl: who am I, pods, logs, one command, errors."
---

# Quick start

**You want to:** call OpenConsole from a terminal with an API key, before handing it to an agent.

You need `curl` and `jq`. The examples were run against a test cluster with the `crashlab` namespace of the code
repository's `hack/k3d/crashlab.yaml`; your names will differ.

## 1. Create a key

In OpenConsole: your name (top right) → **API keys** → **New API key**. Pick the cluster, the namespaces and the
**Read-only (safe)** template, then copy the key (`oc_` and 40 characters). It is shown once. Details:
[Your API keys](/user-guide/api-keys).

```bash
export OC_URL=https://openconsole.example.com   # your OpenConsole address, no trailing slash
export OPENCONSOLE_API_KEY=oc_…                  # the key you copied
```

## 2. Who am I

```bash
curl -s -H "Authorization: Bearer $OPENCONSOLE_API_KEY" "$OC_URL/api/auth/me" \
  | jq '{key: .apiKey.name, grants: .apiKey.grants, namespaces}'
```

```json
{
  "key": "claude-code",
  "grants": ["deployments:get", "deployments:list", "pods:get", "pods:list", "pods:logs"],
  "namespaces": ["crashlab"]
}
```

`namespaces` and `permissions` in the full answer are what the key reaches **now** (key ∩ your roles ∩ the admin's
policy); start every script or agent with this call.

## 3. Pick the cluster

Each request works on your selected cluster unless it names one with `X-OpenConsole-Cluster`, by name or id. The
clusters the key can use:

```bash
curl -s -H "Authorization: Bearer $OPENCONSOLE_API_KEY" "$OC_URL/api/clusters/public"
```

```json
{"items":[{"id":1,"name":"k3d","isActive":true,"selected":true}]}
```

Then name it on each request:

```bash
curl -s -H "Authorization: Bearer $OPENCONSOLE_API_KEY" -H "X-OpenConsole-Cluster: k3d" \
  "$OC_URL/api/namespaces/crashlab/pods" \
  | jq -r '.items[] | [.metadata.name, .status.phase, .status.containerStatuses[0].restartCount] | @tsv'
```

```text
agent-598r8	Running	0
badimage-67b7966bb-82lhs	Pending	0
brokendb-0	Running	6
db-0	Running	0
db-1	Running	0
…
```

Lists return the Kubernetes objects as the API server sends them (`metadata`, `spec`, `status`) under `items`.

## 4. Read a log

```bash
curl -s -H "Authorization: Bearer $OPENCONSOLE_API_KEY" \
  "$OC_URL/api/namespaces/crashlab/pods/exit1-6bb6b857dc-bbcxg/logs?container=app&previous=true&tailLines=5"
```

```text
starting
fatal: config missing
```

Plain text. `previous=true` is the container run before the current one (the one that crashed); `tailLines` defaults
to 500. Right after a restart Kubernetes may answer `unable to retrieve container logs for containerd://…` for a
while, like `kubectl logs --previous` does: if the container is in `Error` now, read without `previous`.

## 5. Run one command

Needs `pods:exec` on the key (the **Read-only** templates don't have it):

```bash
curl -s -H "Authorization: Bearer $OPENCONSOLE_API_KEY" -H "Content-Type: application/json" \
  -d '{"container": "app", "command": ["uname", "-sr"], "timeoutSeconds": 30}' \
  "$OC_URL/api/namespaces/crashlab/pods/healthy-66fb4fb769-4cjqs/exec"
```

```json
{"stdout":"Linux 6.8.0-110-generic\n","stderr":"","exitCode":0,"truncated":false,"durationMs":496}
```

`command` is an argv array, not run in a shell (`["sh", "-c", "…"]` for pipes). A non-zero exit code is still a 200.
The command is recorded like a shell session; the audit event keeps only the program (`uname`), never the arguments.

## Errors

Every refusal is audited. The body names the reason:

| Status | Body | Means |
|---|---|---|
| 401 | empty | The key is unknown, expired or revoked, or its owner is disabled. |
| 403 | `{"error":"change your password first"}` | The owner must change their password (first sign-in or an admin reset). |
| 403 | `{"error":"forbidden"}` | The key doesn't list it, or you don't hold it in that namespace. |
| 403 | `{"error":"api_access_policy"}` | You hold it on the web, but the admin's API access policy keeps it from keys. |
| 403 | `{"error":"api_access_off"}` | The policy gives your keys nothing; every call is refused, `/api/auth/me` too. |
| 403 | `{"error":"api_key_not_allowed"}` | Web session only (managing keys, password, saved views). |
| 403 | `{"error":"feature_disabled"}` | The operator switched the feature off (`FEATURE_*=false`). |
| 403 | `{"error":"admin_only"}` | An admin endpoint, and the key isn't an Admin API key of an admin. |
| 400 | `{"error":"cluster \"nope\" is unknown or not reachable with this key"}` | `X-OpenConsole-Cluster` names a cluster that doesn't exist or isn't in the key. |
| 429 | empty | More than 10 requests a second for this key; see [Limits](/api/limits). |

Seen on the test cluster with:

```bash
curl -s -w ' %{http_code}\n' -H "Authorization: Bearer $OPENCONSOLE_API_KEY" "$OC_URL/api/namespaces/kube-system/pods"
# {"error":"forbidden"}
#  403
curl -s -w ' %{http_code}\n' -H "Authorization: Bearer $OPENCONSOLE_API_KEY" "$OC_URL/api/me/api-keys"
# {"error":"api_key_not_allowed"}
#  403
curl -s -w ' %{http_code}\n' -H "Authorization: Bearer $OPENCONSOLE_API_KEY" -H "X-OpenConsole-Cluster: nope" \
  "$OC_URL/api/namespaces/crashlab/pods"
# {"error":"cluster \"nope\" is unknown or not reachable with this key"}
#  400
curl -s -w ' %{http_code}\n' -H "Authorization: Bearer $OPENCONSOLE_API_KEY" "$OC_URL/api/admin/users"
# {"error":"admin_only"}
#  403
```

**Next:** give it to an agent: [Agent recipes](/api/agent-recipes). Every endpoint:
[endpoint reference](/api/endpoints/openconsole-api).
