---
title: "Build from source"
description: "Build your own image and run the tests."
---

# Build from source

## Option A — your own image

```bash
docker build -t kubernetes-openconsole:local .
```

## Tests

CI runs these on every push. Run them locally before you open a PR:

```bash
cd backend && go vet ./... && go test -race ./...    # recorder, exec bridge, RBAC engine, API, store, LDAP, Azure AD, tracing
cd frontend && npx tsc --noEmit -p . && npm test && npm run build
```

- The API tests run the real router and SQLite store against client-go's fake clientset. They check that every admin endpoint, namespace / resource / cluster-scoped grant, write action (403 + `denied` audit) and secret reveal is enforced, plus feature flags, saved views, CSV exports, the password policy and the exec session limit.
- Store tests upgrade a pre-2.x database schema and check that every migration is idempotent and that credentials are encrypted at rest.
- LDAP is tested end to end against an in-process LDAP server (configure → test → search → import → sign in → disable); Azure AD against a fake Entra token endpoint (state, audience, issuer and expiry are all rejected when wrong).
- Frontend (`npm test`, Vitest + Testing Library + axe-core): EN / TR dictionaries have the same keys and every `t('…')` key used in the code exists, table keyboard navigation, dialogs, and accessibility checks on the main components.
