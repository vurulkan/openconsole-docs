---
title: "Azure AD (Entra ID)"
sidebar_label: "Azure AD"
description: "Single-tenant Microsoft sign-in."
---

# Azure AD (Entra ID)

Single-tenant sign-in that works alongside local / LDAP accounts.

**1. App registration** (Azure portal → Entra ID → App registrations → New):
- Supported account types: **single tenant**.
- Redirect URI (Web): `https://<your-openconsole-host>/api/auth/azure/callback`.
- Certificates & secrets → new **client secret**.
- Scopes used: `openid profile email`; no extra API permissions are needed.

**2. Configure** (Admin → Azure AD): **Enabled**, **Tenant ID**, **Client ID**, **Client secret** (stored encrypted; leave it empty to keep the stored one) and **Redirect URL** (the same URI as above). Save, then **Test configuration**.

**3. Sign-in**: the login page shows **Sign in with Microsoft**. On a user's first successful sign-in, the account is created automatically with source **Azure AD**. The username is the token's `preferred_username`, or `email` / `upn` if that is missing.

**4. Give them access**: add the new user to groups after their first sign-in. Or, better, set them up in advance: **Admin → Users → New user → Azure AD user**, enter their UPN or e-mail address (e.g. `jane@example.com`) and pick the groups. The first Microsoft sign-in then uses that account.

How the account is found on sign-in:
- First by `preferred_username`, which is usually the UPN.
- If there's no exact match, OpenConsole looks for a **pre-created Azure AD account that nobody has signed in to yet** whose name matches `preferred_username` in another letter case, or the token's `email` or `upn` claim. That covers a pre-created `jane.doe@corp.com` when the UPN is `jdoe@corp.onmicrosoft.com`.
- Local, LDAP and already used accounts are never claimed this way. The `user.login` audit event notes when an account was claimed (`linked_by`, `signed_in_as`).

Signing out of OpenConsole does not sign the user out of Microsoft.

## Azure AD OAuth (only if used)
Configured through **Admin → Azure AD** at runtime. The only env var is for national clouds:

- `AZURE_AD_AUTHORITY` (default `https://login.microsoftonline.com`) — e.g. `https://login.microsoftonline.us` (US Government) or `https://login.chinacloudapi.cn` (China).
