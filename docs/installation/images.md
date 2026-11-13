---
title: "Images and verification"
description: "Release tags, multi-arch images and verifying attestations."
---

# Images and verification

```yaml
image: ghcr.io/vurulkan/kubernetes-openconsole:2.22.0   # pin a release
```

Images are multi-arch (**linux/amd64** and **linux/arm64**: Graviton, Ampere, Apple silicon); the runtime picks the right one. CI is the only publisher. Release tags:

| Tag | Points to | Moves? |
|---|---|---|
| `X.Y.Z` (e.g. `2.22.0`) | that release | no — use this in production |
| `latest` | the newest release, same image (same digest) as its `X.Y.Z` | yes, on each release |

Releasing = push the `vX.Y.Z` git tag; CI builds once and pushes `:X.Y.Z` and `:latest`. Pushes to `main` are built and tested but not published. Pushes to other branches publish pre-release test images as `:dev-<build number>` and `:dev-latest`; never run those in production, and `:latest` never points to one.

## Verifying an image

Every release image has a signed SLSA **build provenance** and an SPDX **SBOM** attestation, created by the CI workflow with [GitHub artifact attestations](https://docs.github.com/en/actions/security-for-github-actions/using-artifact-attestations) (Sigstore, keyless). They are stored on GitHub, so the registry holds nothing but the image tags.

```bash
# Provenance: built by this repository's CI from a release tag
gh attestation verify oci://ghcr.io/vurulkan/kubernetes-openconsole:2.22.0 \
  --repo vurulkan/kubernetes-openconsole \
  --signer-workflow vurulkan/kubernetes-openconsole/.github/workflows/ci.yml

# SBOM (packages in the image)
gh attestation verify oci://ghcr.io/vurulkan/kubernetes-openconsole:2.22.0 \
  --repo vurulkan/kubernetes-openconsole \
  --predicate-type https://spdx.dev/Document/v2.3 --format json \
  --jq '.[0].verificationResult.statement.predicate.packages | length'
```

Kyverno and the Sigstore policy-controller can check the same attestations before a pod is admitted. (2.14.0 and 2.14.1 were signed with cosign instead: `cosign verify` with `--certificate-oidc-issuer https://token.actions.githubusercontent.com`.)
