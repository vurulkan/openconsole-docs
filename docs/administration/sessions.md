---
title: "Sessions"
description: "Active sessions, revocation, session timeout."
---

# Sessions

Every issued token lives in `session_tokens` and is checked on every request.

- List all sessions, filter "Only active".
- Revoke a single session, or revoke every session for a user.
- Change-password revokes every session the user has (including the browser that initiated the change).
- Rolling upgrades don't log everyone out — JWTs issued before 2.3.0 are honoured until their natural expiry.
- Audit entries: `session.revoke` (one session, or `all: true` for every session of a user).

## Session timeout

**Admin → Session**: how long a login token stays valid (minutes, default 60). This applies to new logins. The same tab holds the [API key expiry policy](/api/api-keys).
