---
title: "LDAP / Active Directory"
description: "Configure LDAP, import users, accounts on first sign-in."
---

# LDAP / Active Directory

LDAP works alongside local accounts. By default users must exist in OpenConsole before they can sign in, so you **import** them. Alternatively, turn on **Create an account on a user's first sign-in** ([below](/administration/ldap#accounts-on-first-sign-in)) and skip importing.

**1. Configure** (Admin → LDAP):

| Field | Meaning |
|---|---|
| Enabled | turns LDAP sign-in on or off |
| URL *or* Host + Port | `ldap://dc01.example.corp:389` or `ldaps://…:636`; or fill Host / Port / **Use SSL** instead |
| StartTLS | upgrade a plain `ldap://` connection to TLS |
| Skip TLS certificate verification | only for testing; leave it off in production |
| Timeout | seconds per LDAP operation (default 10) |
| Bind DN / Bind password | service account used to search the directory, e.g. `CN=svc-openconsole,OU=ServiceAccounts,DC=example,DC=corp`. The password is stored encrypted; tick **Update Bind Password** only when changing it. |
| User base DN (+ additional base DNs) | where users are searched, one DN per line for several OUs |
| User filter | LDAP filter with `%s` for the typed name. AD: `(sAMAccountName=%s)`, or `(sAMAccountName=%s*)` for prefix search in the import box. OpenLDAP: `(uid=%s)`. |
| Username attribute | the attribute that becomes the OpenConsole username: `sAMAccountName` (AD) or `uid` (OpenLDAP) |

**Save LDAP settings**, then **Test connection**. The test binds with the service account and runs a search in each base DN.

**2. Import users**: from **Admin → Users → New user → Import from LDAP…**, or under the settings on Admin → LDAP. Type part of a name and search; the user filter is applied with `%s` replaced by what you typed, and results are capped at 100 per base DN. Users who already have an account are listed separately and can't be picked again. Pick the users, optionally pick **groups** to add them to, and import. Imported accounts get source **LDAP** and no usable local password. Users who already exist are skipped and reported. The `admin.import` audit entry names the imported users.

**3. Give them access**: if you didn't pick groups during the import, add the users to groups (Admin → Users → edit, or Admin → Groups). Until then they can sign in but see no namespaces.

**4. Sign-in**: users type their directory username and password on the normal login form. OpenConsole finds their DN with the user filter and binds as them. A wildcard filter (`%s*`) is safe here: at login, OpenConsole additionally requires an exact match on the username attribute, so `jo` can never resolve to `john`. Turning **Enabled** off stops all LDAP sign-ins immediately.

### Accounts on first sign-in

Off by default. In **Admin → LDAP**, tick **Create an account on a user's first sign-in**, optionally pick **groups for new accounts**, and save. From then on:

- Someone without an account who signs in with valid directory credentials gets an LDAP account on the spot, under the name the directory uses (typing `John` signs in to `john`). The account is added to the chosen groups, so it can see something right away.
- Anyone the **user filter** finds under the base DNs can sign in. To allow only one directory group, put it in the filter, e.g. `(&(sAMAccountName=%s)(memberOf=CN=OpenConsole Users,OU=Groups,DC=example,DC=corp))`.
- New accounts are never admins. Each one is audited as `user.create` with `auto_provisioned: true`.
- **To lock someone out, disable their account; don't delete it.** A deleted account is created again on the next sign-in, while a disabled one stays disabled.
- Unknown users with a wrong password are rejected as before; nothing is created.

> Example (anonymized) Active Directory setup: Host `10.10.20.15`, Port `389`, Bind DN `CN=svc-openconsole,OU=ServiceAccounts,OU=IT,DC=example,DC=corp`, User base DN `OU=Engineering,OU=Users,DC=example,DC=corp`, User filter `(sAMAccountName=%s)`, Username attribute `sAMAccountName`.

## LDAP (only if used)
Configured through **Admin → LDAP** at runtime — no env vars.
