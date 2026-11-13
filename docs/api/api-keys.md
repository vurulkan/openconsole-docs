---
title: "API and agents"
description: "API keys, admin policy, OpenAPI and endpoints for agents."
---

# API and agents

An API key lets your AI agent (Claude Code, Cursor, …) or a script call the OpenConsole API in your name. Every action and every resource read is audited with your user **and the key's name**. Open it from the account menu (your name, top right) → **API keys**, or `⌘K` → *Go to API keys*.

**Creating one.** Name and note; expiry (7 / 30 / 60 / 90 days, a date, or none — a key without an expiry stays valid until you revoke it; the admin can limit both, see *Expiry policy* below); scope: all clusters or one, all your namespaces (including ones you get later) or a selection; then a template and the permission matrix:

| Template | Gives |
|---|---|
| Read-only (safe) | `list` / `get` / `logs`, no ConfigMaps or Secrets; no exec, edit, scale, restart (the same list as the *Safe read-only* API access below) |
| Read-only (all) | `list` / `get` / `logs` everywhere, ConfigMap data and `secrets:reveal` included; no exec |
| All my permissions | everything you hold in the chosen scope |
| Custom | what you pick |

The matrix offers only what you hold yourself and the [admin policy](/api/api-keys) lets keys have: other cells are closed (*"You do not have this permission"*, or *"The admin's API access policy does not allow it"*); a cell you hold in only some of the chosen namespaces is marked (*"Only in 3 of 5 namespaces"*). The server checks this too (400). The key (`oc_` + 40 characters) is shown **once**, with a ready `curl` line; the list shows its first characters only. The database keeps a SHA-256 of it.

**What a key can do.** At most what it lists **and** what you hold at the time of the call: if a namespace is taken from your role, the key loses it at once (the list shows *"2 permissions not valid now"*); if you get more, the key does not grow by itself (except *all my namespaces*). Edit changes name, note, scope and permissions; the secret and expiry stay. **Regenerate** gives a new secret and a new expiry; the old secret stops working at once (it also revives a revoked or expired key). **Revoke** stops it for good; **Delete** removes it from the list. Admin endpoints (`/api/admin/*`) need an admin's key created with the **Admin API** box, and stop working when the owner is no longer an admin. A key can never manage keys, change the password, change your selected cluster, or save views (403, reason `api_key_not_allowed`).

**Using a key.**

```bash
export OPENCONSOLE_API_KEY=oc_…
curl -H "Authorization: Bearer $OPENCONSOLE_API_KEY" -H "X-OpenConsole-Cluster: prod" https://openconsole.example/api/namespaces/shop/pods
```

- `X-OpenConsole-Cluster: <name or id>` picks the cluster per request (without it: your selected cluster). An unknown cluster is 400, one the key can't use 403.
- WebSockets (logs, exec, events): `POST /api/ws-ticket` with the key, then open the socket with `?ticket=`. Keys are never accepted in a URL.
- 401 = the key is not valid (unknown, expired, revoked, owner disabled); 403 = not allowed (permission, admin policy, feature flag, owner must change the password; the body names the reason); 429 = more than 10 requests / s (burst 30) for the key.
- A shell or a command run with a key is always recorded, and shows the key name in Admin → Recordings.

**For agents.** The API is described in OpenAPI 3.1 at `GET /api/openapi.json` (no sign-in; no hostnames, users or secrets in it), and in the app under **API keys → Documentation**: quick start, a ready text to give your agent (the key stays in `OPENCONSOLE_API_KEY`, never in the text), every endpoint a key can call grouped by tag with its permission, parameters, a `curl` example and example responses, and the errors. Endpoints none of your keys can call now are greyed out with the reason (*You do not have it*, *Policy does not allow*, *Switched off*); web-only endpoints are left out, admin ones are shown to admins only. A test fails the build when a route in `router.go` is missing from the description.

Two endpoints exist so an agent never needs a WebSocket:

```bash
# The end of a pod's log as text (pods:logs; audited as pod.logs)
curl -H "Authorization: Bearer $OPENCONSOLE_API_KEY" \
  "$OC_URL/api/namespaces/shop/pods/web-7c9f/logs?tailLines=200&previous=true"

# One command in a container (pods:exec; recorded; audited as pod.exec)
curl -H "Authorization: Bearer $OPENCONSOLE_API_KEY" -H "Content-Type: application/json" \
  -d '{"container":"app","command":["cat","/etc/os-release"],"timeoutSeconds":30}' \
  "$OC_URL/api/namespaces/shop/pods/web-7c9f/exec"
# → {"stdout":"NAME=…","stderr":"","exitCode":0,"truncated":false,"durationMs":184}
```

| Endpoint | Logs `GET …/pods/{name}/logs` | Command `POST …/pods/{name}/exec` |
|---|---|---|
| Input | `container`, `tailLines` (default 500, at most 10 000), `sinceSeconds`, `previous`, `timestamps` | `command` (argv array, **not** run in a shell: `["sh","-c","…"]` for pipes), `container`, `timeoutSeconds` (1–120, default 30); no stdin |
| Output | `text/plain`, at most 5 MiB (cut at a line end, header `X-OpenConsole-Truncated: true`) | `stdout`, `stderr` (1 MiB each; the rest is dropped and `truncated` is true, the command still runs to its end), `exitCode`, `durationMs`. A non-zero exit code is a 200. Past the timeout: what was printed so far, `exitCode: -1`, `truncated: true`; Kubernetes doesn't stop the process, it may run on in the container. Output is text (non-UTF-8 bytes become `�`; use `base64` for binary) |
| Errors | 400 bad parameter, `container_not_found`, `previous_unavailable`, `not_ready`; 404 `pod_not_found`; 429 too many log requests | 400 bad body, `container_not_found`, `not_ready`; 403 `forbidden`, `api_access_policy`, `feature_disabled` (`FEATURE_POD_EXEC=false`); 404 `pod_not_found`; 429 `too_many_sessions` (counts with the user's shells, `MAX_EXEC_SESSIONS_PER_USER`); 503 `recording_unavailable` (a key's command that can't be recorded); 502 `exec_failed` |

A command is recorded like a shell: the first line is `$ <command>`, then its output, and Admin → Recordings marks it *command*. The audit event (`pod.exec`, `mode: command`) keeps only the program (`command[0]`, e.g. `cat`), the exit code, bytes, duration and the recording's id, **never the whole command line**, which may hold a password; only admins can replay the recording. A web session can call both endpoints too.

Giving it to Claude Code (or any agent that runs `curl`):

```bash
export OPENCONSOLE_API_KEY=oc_…   # in the agent's environment, not in the prompt
claude "Use the OpenConsole API at $OC_URL (spec: $OC_URL/api/openapi.json; send Authorization: Bearer \$OPENCONSOLE_API_KEY and X-OpenConsole-Cluster: nonprod). Find the crash-looping pods in the ci-dev namespace and summarize their last logs."
```

**Admin policy.** An admin decides how much of a user's permissions their keys may get:

| Where | Choices |
|---|---|
| **Role** (Admin → Roles → *API access*; a column in the list, a line above Role Permissions) | **Off**: nothing from this role · **Safe read-only** (default, also for roles made before 2.22): `list` / `get` / `logs`, no ConfigMaps or Secrets, no exec, edit, scale, restart · **All of the role's permissions** |
| **User** (Admin → Users → edit → *API access*; a column and a filter in the list) | **By roles** (default) · **Off** · **Safe read-only** · **All of their permissions** (ignores the role modes, never more than the user has on the web) |

With several roles each role's grants go through its own mode, then add up: role A (`ns1`, all permissions) + role B (`ns2`, safe read-only) lets a key exec in `ns1` and only read in `ns2`. An admin's roles don't apply to them (admins hold everything), so an admin's keys follow only the override; with *Off* or *Safe read-only* the **Admin API** box can't be ticked and an existing Admin API key loses admin access. The user dialog previews what the user's keys may reach under the chosen setting (`ns1: all permissions · ns2: read-only`), shows the number of active keys, and has **Revoke all their keys**.

The policy never changes a key: a cell it takes away stops working (the key list shows *"N permissions not valid now"*, the form says *"The admin's API access policy does not allow it"*), and works again when the policy allows it. Editing such a key keeps those cells (struck through; you can remove them, not add new ones), and the Admin API box too. A call refused by the policy gets 403 with reason `api_access_policy` (in the body and the audit log). When the policy leaves a user's keys nothing (override *Off*, or every role *Off*) every call with the key is refused, `/api/auth/me` included: 403, reason `api_access_off`, audited as `api_key.use` denied.

**Expiry policy** (Admin → Session → *API key expiry*): **Longest lifetime** in days (empty = no limit) and **Allow keys that never expire**. The form hides the presets beyond the limit, caps the date and hides *No expiry* when it isn't allowed; the server checks create and Regenerate too (400). Lowering the limit doesn't touch existing keys, so agents aren't cut off without notice; find them under Admin → API keys → *Outside the expiry policy*.

**Admin → API keys** lists every user's keys: owner, name, prefix (never the secret), permissions, last use and IP, expiry and status; filter by owner, status, *Includes exec*, *Admin API*, *Outside the expiry policy*; **Revoke** with an optional reason (audited as `api_key.revoke` with `by_admin`, `owner`, `comment`); **Export CSV**. An admin can't edit another user's key. These screens, and `GET /api/admin/api-keys`, `…/export`, `POST /api/admin/api-keys/{id}/revoke`, `POST /api/admin/users/{id}/revoke-api-keys`, work with a web session only, never with a key (also not an Admin API key). `GET /api/admin/users/{id}/api-access?override=` is the preview.

**Audit.** Every audit event made with a key carries `api_key_id` / `api_key_name` (Admin → Audit Logs: *Source* = Web / API key, key name; the CSV has `api_key_name`). Calls that read no cluster resource, `/api/auth/me`, `/api/ws-ticket`, `/api/features`, `/api/version`, `/api/openapi.json`, are not audited; the request log still has them. Key events: `api_key.create` / `update` / `regenerate` / `revoke` / `delete`, and `api_key.use` with outcome `denied` (`expired`, `revoked`, `owner_inactive`, `must_change_password`, `api_access_off`) or `rate_limited`; these are written at most once a minute per key and reason, so an agent retrying with a dead key can't flood the log (every request still gets its 401 / 403 / 429). An unknown key has no user, so it is only a warning line in the console log, with the source IP. Successful reads with a key are kept `API_KEY_READ_RETENTION_DAYS` (7).
