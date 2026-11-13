---
title: "Verify the image"
description: "Release tags, pinning a version, and checking an image's provenance and SBOM before you run it."
---

# Verify the image

## Tags

Images are published to `ghcr.io/vurulkan/kubernetes-openconsole` for **linux/amd64** and **linux/arm64**
(Graviton, Ampere, Apple silicon); the runtime picks the right one. Only the project's CI publishes them.

| Tag | Points to | Moves? |
|---|---|---|
| `X.Y.Z` (e.g. `2.22.0`) | that release | no: **use this in production** |
| `latest` | the newest release, the same image (same digest) as its `X.Y.Z` | yes, on each release |
| `dev-<number>`, `dev-latest` | test builds of unreleased branches | never run these in production |

The manifests in `deploy/` use `:latest` with `imagePullPolicy: Always`, so any restart of the pod could move you
to a new release. Pin the version as in [Install on Kubernetes](/installation/kubernetes) (`images:` → `newTag`).
To pin the exact bytes, use the digest instead of the tag:

```bash
# the digest of a tag, after pulling it
docker pull ghcr.io/vurulkan/kubernetes-openconsole:2.22.0
docker inspect --format '{{index .RepoDigests 0}}' ghcr.io/vurulkan/kubernetes-openconsole:2.22.0
# → ghcr.io/vurulkan/kubernetes-openconsole@sha256:f4d193cf9d2d65aa0c1c863e3221ced13eb0d17cd3d18cff09ecd3cac91935b2

# or the digest your cluster is running
kubectl -n kubernetes-openconsole get pod -l app=kubernetes-openconsole \
  -o jsonpath='{.items[0].status.containerStatuses[0].imageID}'
```

```yaml title="kustomization.yaml"
images:
  - name: ghcr.io/vurulkan/kubernetes-openconsole
    digest: sha256:f4d193cf9d2d65aa0c1c863e3221ced13eb0d17cd3d18cff09ecd3cac91935b2   # 2.22.0
```

## Provenance and SBOM

Every release image has two attestations, signed by the CI workflow with
[GitHub artifact attestations](https://docs.github.com/en/actions/security-for-github-actions/using-artifact-attestations)
(Sigstore, keyless) and stored on GitHub: a SLSA **build provenance** (which repository, workflow and commit built
it) and an SPDX **SBOM** (every package in the image). Check them with the [GitHub CLI](https://cli.github.com/):

```bash
# Built by this repository's CI workflow (exit code 0 = verified)
gh attestation verify oci://ghcr.io/vurulkan/kubernetes-openconsole:2.22.0 \
  --repo vurulkan/kubernetes-openconsole \
  --signer-workflow vurulkan/kubernetes-openconsole/.github/workflows/ci.yml

# Download the SBOM (SPDX 2.3 JSON)
gh attestation verify oci://ghcr.io/vurulkan/kubernetes-openconsole:2.22.0 \
  --repo vurulkan/kubernetes-openconsole \
  --predicate-type https://spdx.dev/Document/v2.3 --format json \
  --jq '.[0].verificationResult.statement.predicate' > openconsole-2.22.0.spdx.json
```

An image that wasn't built by this repository fails the first command with a non-zero exit code. Feed the SBOM to
your scanner (Grype, Trivy, Dependency-Track).

If `gh attestation verify` or `docker pull` answers **denied** although the image is public, you are logged in to
`ghcr.io` with an expired token: run `docker logout ghcr.io` and try again.

Kyverno and the Sigstore policy-controller can check the same attestations before a pod is admitted. Releases
2.14.0 and 2.14.1 were signed with cosign instead (`cosign verify` with
`--certificate-oidc-issuer https://token.actions.githubusercontent.com`).
