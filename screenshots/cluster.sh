#!/usr/bin/env bash
# Creates the throwaway k3d cluster the screenshots are recorded from, installs the
# OpenConsole release in VERSION with the kustomization of "Install on Kubernetes",
# applies seed/workloads.yaml and port-forwards the UI to localhost:18080.
# Needs docker, k3d, kubectl, git. Never touches your kubeconfig: everything uses
# screenshots/.work/kubeconfig.
set -euo pipefail
cd "$(dirname "$0")"
VERSION=$(node -p "require('./config.json').version")
CLUSTER=oc-docs
WORK=.work
mkdir -p "$WORK/install"
export KUBECONFIG="$PWD/$WORK/kubeconfig"
K="kubectl --context k3d-$CLUSTER"

case "${1:-up}" in
  up)
    k3d cluster list "$CLUSTER" >/dev/null 2>&1 || \
      k3d cluster create "$CLUSTER" --kubeconfig-update-default=false --kubeconfig-switch-context=false --wait
    k3d kubeconfig get "$CLUSTER" > "$KUBECONFIG"
    cat > "$WORK/install/kustomization.yaml" <<YAML
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
resources:
  - https://github.com/vurulkan/kubernetes-openconsole//deploy?ref=v$VERSION
images:
  - name: ghcr.io/vurulkan/kubernetes-openconsole
    newTag: "$VERSION"
patches:
  - patch: |-
      apiVersion: apps/v1
      kind: Deployment
      metadata:
        name: kubernetes-openconsole
        namespace: kubernetes-openconsole
      spec:
        strategy:
          type: Recreate
          rollingUpdate: null
        template:
          spec:
            containers:
              - name: dashboard
                imagePullPolicy: IfNotPresent
                env:
                  - name: TIMEZONE
                    value: UTC
YAML
    $K apply -k "$WORK/install"
    $K apply -f seed/workloads.yaml
    $K -n kubernetes-openconsole rollout status deploy/kubernetes-openconsole --timeout=5m
    $K -n shop rollout status deploy/storefront --timeout=5m
    echo "cluster ready; run: ./cluster.sh forward"
    ;;
  forward)
    while true; do $K -n kubernetes-openconsole port-forward svc/kubernetes-openconsole 18080:80 >/dev/null 2>&1 || true; sleep 1; done
    ;;
  token)
    NS=kubernetes-openconsole
    printf '%s\n%s\n' "$($K -n $NS get secret openconsole-reader-token -o jsonpath='{.data.token}' | base64 -d)" \
      "$($K -n $NS get secret openconsole-reader-token -o jsonpath='{.data.ca\.crt}')"
    ;;
  down)
    k3d cluster delete "$CLUSTER"
    ;;
esac
