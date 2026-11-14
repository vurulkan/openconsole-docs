---
title: "First login and admin checklist"
sidebar_label: "First login"
description: "The default admin, the password policy, and the first things to set up, in order."
---

# First login and admin checklist

## First login

On its very first start OpenConsole creates one admin: **`admin` / `admin`**. Sign in with it and choose a new
password; until you do, every other page and API call is refused. After the change you are signed out; sign in
again with the new password.

Local passwords must be at least 8 characters (`PASSWORD_MIN_LENGTH`), at most 72 bytes, not blank, and a change
must actually change the password. Five failed sign-ins for one user from one address lock that pair for five
minutes.

## Admin checklist

Do these in order; each step needs the one before.

1. **Connect your clusters.** Admin → Clusters → Add Cluster, then **Set as default** on the one most people use
   ([Connect a cluster](/installation/connect-cluster)). Every user can switch to another cluster their permissions
   cover; the choice is per user.
2. **Give yourself a personal account.** Admin → Users → New user, tick **Grant admin privileges**. Sign in with it from now on, so
   the audit log names a person. Keep `admin` with a long password as a break-glass account, or disable it once a
   second admin exists (the last active admin can't be disabled or deleted).
3. **Create roles.** Admin → Roles → **New role** (name, description, API access), then **Add permissions** in its
   Role Permissions panel: a cluster (or all clusters), one or more namespaces and a template (Viewer, Developer,
   SRE, Admin) or single actions. A good first role is a Viewer of one namespace. **Viewer** is `list` and `get` on
   every kind, Secret metadata included (names and keys, not values), and **no logs**: add `pods:logs` if viewers
   should read logs. The full list of actions: [Application permissions](/reference/permissions).
4. **Create groups and give them roles.** Admin → Groups → **New group** (a name), then **Edit group** (pencil) →
   Roles → *Assign roles…*. Access always goes
   user → group → role; a user in no group sees no namespaces.
5. **Add people.** Pick one way (or several side by side):
   - **Local accounts**: Admin → Users → New user (with LDAP or Azure AD enabled: → Local user), with groups. You
     set the first password; the user is not forced to change it, so ask them to (header menu → change password).
   - **LDAP / Active Directory**: Admin → LDAP: fill in the settings, **Test connection**, then import users into
     groups (Admin → Users → New user → Import from LDAP…), or turn on *Create an account on a user's first
     sign-in* with default groups. Sign in once as an LDAP user before telling everyone.
     [LDAP / Active Directory](/administration/ldap)
   - **Azure AD (Entra ID)**: create the app registration, fill in Admin → Azure AD, **Test configuration**, then
     pre-create users with their groups (New user → Azure AD user) so they see something on their first
     "Sign in with Microsoft". [Azure AD](/administration/azure-ad)
6. **Check what a user sees.** Sign in as a non-admin in a private window: only their namespaces, no Admin,
   Overview or Nodes, no restart / scale / edit / shell without the permission. (2.22.0 still shows a **Logs**
   button without `pods:logs`; it answers *You may not read this log*.)
7. **Optional settings**:
   - Admin → Session: how long a sign-in lasts (default 60 minutes) and the API key expiry policy
     ([Sessions](/administration/sessions)).
   - Admin → Recordings → Recording settings: shell recording on / off, retention, disk quota
     ([Session recording](/administration/recordings)).
   - Admin → Roles → *API access*: how much of each role users' API keys may use (default *Safe read-only*)
     ([API and agents](/api/overview)).
   - Admin → Clusters → Prometheus: longer usage history ([Prometheus](/administration/prometheus)).
   - Admin → Customization: your logo.
8. **Ship the audit log.** It is in the database for `LOG_RETENTION_DAYS` (30) and on stdout as JSON; send stdout
   to your log platform to keep it longer ([Logging and Elastic](/operations/logging)).
9. **Plan backups** of the volume ([Backup and restore](/installation/backup-restore)).
