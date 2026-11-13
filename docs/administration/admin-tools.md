---
title: "Audit logs and admin tools"
sidebar_label: "Admin tools"
description: "Audit Logs, CSV exports, API keys, recordings, customization."
---

# Audit logs and admin tools

- **Audit Logs**: every read and write action with user, outcome, cluster, namespace and resource; **Details** on a row shows its details, reason, source IP, account source, request id and user agent ([Audit events](/reference/audit-events)). Retention: `LOG_RETENTION_DAYS`. The CSV export uses the same filters as the screen and has a column per field (details as JSON). Filters:
  - **User**, **Action** and **Namespace** suggest the values that actually occur in the log as you type. Typed text matches anywhere.
  - Picking an action matches it exactly. Its family row, e.g. `pod.*`, selects everything done to pods.
  - **Outcome** (success / denied / failed / rate_limited / locked), **Verb** (list, restart, exec, …), **Resource type** and **Cluster** narrow any of them, e.g. "everything denied", or `secret.*` + denied.
  - **Source**: Web or API key, and the key's name; rows done with a key carry a key badge ([API keys](/api/api-keys)).
- **Users / Groups → Export CSV**: who has access and through which group and role.
- **Sessions**: every issued token; revoke one or all of a user's ([Sessions](/administration/sessions)).
- **API keys**: every user's API keys; revoke, export CSV ([API keys](/api/api-keys)).
- **Recordings**: replay, download (with a warning) or delete pod shell sessions, and set retention / disk limits ([Session Recording](/administration/recordings)).

## Customization

**Admin → Customization**: upload a PNG or SVG logo (up to 256 KB), shown in the header and on the login page. Remove it to go back to the default mark.
