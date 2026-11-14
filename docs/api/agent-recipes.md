---
title: "Agent recipes"
description: "Ready setups for Claude Code, Cursor and a shell script, with the key kept in an environment variable."
---

# Agent recipes

**You want to:** let an AI agent or a script look at your workloads, for example "find the crash-looping pods and
summarize their logs", without the key ever showing up in a prompt or a transcript.

Each recipe uses a [key](/api/quick-start#1-create-a-key) with the **Read-only (safe)** template, limited to the
namespaces the agent should see. Add `pods:exec` only if the agent must run commands; every command is recorded.

## The `oc` helper

A small script the agent calls instead of `curl`. It reads the key, the address and the cluster from the environment,
so the commands the agent writes (and you approve) never contain the key or a `$VARIABLE`. Save it as `oc` in the
directory the agent works in:

```bash title="oc"
#!/usr/bin/env bash
# oc <path> [json body]: one OpenConsole API call. The key comes from
# OPENCONSOLE_API_KEY, the address from OC_URL, the cluster from OC_CLUSTER;
# none of them appears in the command an agent runs. With a body it is a POST.
set -euo pipefail
path="${1:?usage: oc <path> [json body]}"
args=(-sS --fail-with-body -H "Authorization: Bearer $OPENCONSOLE_API_KEY")
if [ -n "${OC_CLUSTER:-}" ]; then args+=(-H "X-OpenConsole-Cluster: $OC_CLUSTER"); fi
if [ $# -ge 2 ]; then args+=(-H "Content-Type: application/json" -d "$2"); fi
curl "${args[@]}" "$OC_URL$path"
```

```bash
chmod +x oc
export OC_URL=https://openconsole.example.com   # your OpenConsole address
export OC_CLUSTER=prod                           # optional: cluster name or id; default your selected cluster
export OPENCONSOLE_API_KEY=oc_…                  # the key; never in a prompt or a file in the repo
./oc /api/auth/me | jq -c '{key: .apiKey.name, namespaces}'
```

```json
{"key":"claude-code","namespaces":["crashlab"]}
```

A refused call prints `curl: (22) The requested URL returned error: 403` and the body (`{"error":"forbidden"}`), and
exits non-zero, which agents read well.

## A shell script

Lists the pods of a namespace that restart or can't start, with the end of the log of the container that crashed
(the current run if it has just ended, otherwise the one before):

```bash title="oc-crashes.sh"
#!/usr/bin/env bash
# Pods in one namespace that restart or can't start, with the end of the log of
# the container that crashed. Uses ./oc; needs jq.
set -euo pipefail
ns="${1:?usage: ./oc-crashes.sh <namespace>}"

./oc "/api/namespaces/$ns/pods" | jq -r '
  .items[]
  | {name: .metadata.name, c: ((.status.containerStatuses // [])[0] // {})}
  | select(.c.restartCount > 0 or (.c.state.waiting.reason // "" | test("BackOff|Error")))
  | [.name, .c.name, .c.restartCount,
     (.c.state.waiting.reason // .c.state.terminated.reason // .c.lastState.terminated.reason // "-"),
     (if .c.state.terminated then "false" else "true" end)]  # the crashed run: now or the one before
  | @tsv' |
while IFS=$'\t' read -r pod container restarts reason previous; do
  echo "== $pod ($container): $restarts restarts, $reason"
  { ./oc "/api/namespaces/$ns/pods/$pod/logs?container=$container&previous=$previous&tailLines=5" 2>/dev/null || true; echo; } \
    | sed '/^$/d; s/^/   /'
done
```

```bash
chmod +x oc-crashes.sh
./oc-crashes.sh crashlab
```

```text
== badimage-67b7966bb-82lhs (app): 0 restarts, ImagePullBackOff
   {"error":"previous_unavailable"}
== brokendb-0 (db): 6 restarts, CrashLoopBackOff
   boom
== exit1-6bb6b857dc-bbcxg (app): 6 restarts, CrashLoopBackOff
   fatal: config missing
   starting
== flappy-54fcb745f9-5m6cl (app): 6 restarts, CrashLoopBackOff
   line 56 11:54:09
   line 57 11:54:09
   line 58 11:54:09
   line 59 11:54:10
   line 60 11:54:10
== liveness-5cb5798b6b-8t27p (app): 7 restarts, CrashLoopBackOff
   up
== missingcm-64757c46c4-8xlpj (app): 0 restarts, CreateContainerConfigError
   {"error":"previous_unavailable"}
== oom-56b9dbd646-dkkpz (app): 6 restarts, CrashLoopBackOff
   allocating
```

`previous_unavailable` means the container never ran, so there is no log; the pod's events say why
(`GET /api/namespaces/<ns>/pods/<pod>/events`).

## Claude Code

Give Claude Code the API in the project's `CLAUDE.md` (the same text as **API keys → Documentation → Text for your
agent** in the app, using `./oc`):

```markdown title="CLAUDE.md"
You can use the OpenConsole API (a Kubernetes console). Call it with `./oc <path>` (GET) or
`./oc <path> '<json>'` (POST); the script adds the key, the address and the cluster. Never print
the OPENCONSOLE_API_KEY environment variable.
Read the API description first: `./oc /api/openapi.json`.
Start with `./oc /api/auth/me`: it shows the namespaces and permissions the key has.
For logs use /api/namespaces/<ns>/pods/<pod>/logs?tailLines=200 (add previous=true for the crashed
instance). To run one command: `./oc /api/namespaces/<ns>/pods/<pod>/exec '{"command": ["cat", "/etc/os-release"]}'`
(an argv array, not run in a shell).
Every action and resource read is audited under the key's name.
```

Run it with the helper allowed, so it doesn't stop to ask before each call:

```bash
claude -p "Find the crash-looping pods in the crashlab namespace and summarize the end of their logs in a short table." \
  --allowedTools "Bash(./oc:*)" "Bash(jq:*)"
```

On the test cluster (Claude Code 2.1.317) it read `/api/auth/me`, listed the pods, read each crashed container's log
and answered with a table (three of its rows):

```text
| Pod / container | Restarts | Last exit | End of log | Likely cause |
|---|---|---|---|---|
| `brokendb-0` / db | 6 | 2 (Error), CrashLoopBackOff | `boom` | The app fails on purpose right after it starts. |
| `exit1-…-bbcxg` / app | 6 | 1 (Error) | `starting` → `fatal: config missing` | Its config is missing. |
| `oom-…-dkkpz` / app | 6 | 137 (OOMKilled) | `allocating` | Uses more memory than its limit allows. |
```

Every call it made is in **Admin → Audit Logs** under the key's name.

:::note[Why a helper and not `curl`]
Claude Code asks before it runs a command that expands a variable, such as
`curl -H "Authorization: Bearer $OPENCONSOLE_API_KEY" …`, even when `Bash(curl:*)` is allowed; with `claude -p`
there is nobody to ask, so it stops. With `./oc` the key stays in the environment and the allowed command is exactly `./oc …`.
:::

## Cursor

Cursor's agent reads project rules from `.cursor/rules/`. Put the `oc` helper in the project, export the three
variables in the terminal Cursor starts from, and save the same text as a rule:

```markdown title=".cursor/rules/openconsole.mdc"
---
description: OpenConsole API (Kubernetes console) through ./oc
alwaysApply: false
---
You can use the OpenConsole API (a Kubernetes console). Call it with `./oc <path>` (GET) or
`./oc <path> '<json>'` (POST); the script adds the key, the address and the cluster. Never print
the OPENCONSOLE_API_KEY environment variable.
Read the API description first: `./oc /api/openapi.json`.
Start with `./oc /api/auth/me`: it shows the namespaces and permissions the key has.
For logs use /api/namespaces/<ns>/pods/<pod>/logs?tailLines=200 (add previous=true for the crashed
instance). To run one command: `./oc /api/namespaces/<ns>/pods/<pod>/exec '{"command": ["cat", "/etc/os-release"]}'`
(an argv array, not run in a shell).
Every action and resource read is audited under the key's name.
```

Then ask in the agent chat, for example: *Find the crash-looping pods in the crashlab namespace and summarize the end
of their logs.*

:::info[Can't see it or can't do it?]
- **`{"error":"forbidden"}`**: the key doesn't list that namespace or permission, or you don't hold it any more
  (`./oc /api/auth/me` shows what it reaches now).
- **`{"error":"api_access_policy"}`**: you hold it, but the admin's API access policy keeps it from keys.
- **`curl: (22) The requested URL returned error: 401`**: the key is unknown, expired or revoked, or its owner is
  disabled. **`… error: 429`**: more than 10 calls a second with this key; see [Limits](/api/limits).
:::
