---
title: "Security notes"
description: "Security headers, least privilege, production pattern."
---

# Security notes

- Grant each verb (`patch`, `update`, `pods/exec`, `pods/log`) only if the matching application permission will actually be handed to at least one role.
- OpenConsole's ServiceAccount should never be granted more than the actions the UI will expose. Port-forward is not used. `secrets` get / list is only needed for the Secrets tab; drop that rule if you won't grant any `secrets:*` permission.
- `secrets:reveal`, `secrets:edit` and `pods:exec` are the permissions that expose credentials. Grant them narrowly and review the `secret.reveal`, `secret.view_yaml`, `secret.apply` and `pod.exec` audit events.
- Token rotation is recommended (every 6–12 months).
- Do not store generated tokens in Git.
- Prefer one ServiceAccount per cluster.
- OpenConsole does not bypass Kubernetes RBAC; it operates strictly within the permissions granted to its ServiceAccount.

## Recommended production pattern

- One ServiceAccount per cluster (`deploy/rbac.yaml`), added with its own token — never personal credentials.
- Store tokens securely.
- Rotate periodically.
- Avoid using personal user credentials.

## Security headers
- Strict CSP, `X-Frame-Options: DENY`, `Permissions-Policy`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`.
- CSP allows `cdn.jsdelivr.net` and `worker-src blob:` so Monaco (lazy-loaded) can run; tighten these if you self-host Monaco in an air-gapped deploy.
- CSP `script-src` includes `'wasm-unsafe-eval'` so the bundled recording player can compile its WebAssembly terminal. It permits WebAssembly compilation only, not JavaScript `eval`.
