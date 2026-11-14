---
title: "Tracing (OpenTelemetry)"
sidebar_label: "Tracing"
description: "Send a span for every API request, with the Kubernetes API calls it made, to Jaeger, Tempo or Elastic APM over OTLP."
---

# Tracing (OpenTelemetry)

Tracing is off until an OTLP endpoint is set. Then every API request becomes a span, sent over OTLP/HTTP to any
receiver that speaks it: an OpenTelemetry Collector, Jaeger, Grafana Tempo, Elastic APM.

## Turn it on

Add the endpoint to the container's environment, in the same kustomization as the rest of your settings
([Install on Kubernetes](/installation/kubernetes)):

```yaml title="kustomization.yaml (addition)"
patches:
  - patch: |-
      apiVersion: apps/v1
      kind: Deployment
      metadata:
        name: kubernetes-openconsole
        namespace: kubernetes-openconsole
      spec:
        template:
          spec:
            containers:
              - name: dashboard
                env:
                  - name: OTEL_EXPORTER_OTLP_ENDPOINT
                    value: http://jaeger.observability:4318
```

```bash
kubectl apply -k .
kubectl -n kubernetes-openconsole logs deploy/kubernetes-openconsole | grep 'tracing enabled'
# 2026/11/14 11:42:09 INFO tracing enabled service=openconsole
```

The endpoint is the receiver's **OTLP/HTTP** port (4318 by convention), not gRPC (4317). OpenConsole appends
`/v1/traces` itself; to give the full URL instead, set `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT`. Either variable turns
tracing on.

The standard OpenTelemetry variables apply, as the
[OpenTelemetry SDK](https://opentelemetry.io/docs/languages/sdk-configuration/) defines them:

| Variable | Default | Use |
|---|---|---|
| `OTEL_EXPORTER_OTLP_ENDPOINT` | unset (tracing off) | the receiver, e.g. `http://otel-collector.observability:4318` |
| `OTEL_EXPORTER_OTLP_HEADERS` | unset | e.g. `Authorization=Bearer <token>` for a hosted receiver |
| `OTEL_SERVICE_NAME` | `openconsole` | the service name in the trace UI |
| `OTEL_RESOURCE_ATTRIBUTES` | unset | extra resource attributes, e.g. `k8s.cluster.name=mgmt` |
| `OTEL_TRACES_SAMPLER`, `OTEL_TRACES_SAMPLER_ARG` | every request | e.g. `parentbased_traceidratio` and `0.1` for one in ten |

`APP_VERSION` and `APP_ENV` become the resource attributes `service.version` and `deployment.environment`.

## What a trace contains

| Span | Name | Attributes |
|---|---|---|
| the API request (server) | the route: `GET /api/namespaces/{namespace}/secrets` | `enduser.id` (user name), `openconsole.cluster`, `openconsole.request_id` (the `X-Request-Id`), `http.method`, `http.target`, `http.status_code` |
| each Kubernetes API call it made (client), as a child | `HTTP GET` | `http.url` (the API server URL), `http.status_code` |

Lists of pods, Deployments and other workloads come from OpenConsole's in-memory cache, so those requests have no
child spans; reads that go to the API server (Secrets, YAML, logs, exec, restart, scale, apply) do. Background
watches produce no traces. `/healthz`, `/livez`, `/readyz` and `/metrics` are not traced.

An incoming W3C `traceparent` header is honoured: the request's span becomes a child of your ingress or gateway
span. Request log lines carry the trace id (`trace.id` in `ecs`, `trace_id` in `json`), so you can go from a log
line to its trace:

```bash
curl -s -o /dev/null http://localhost:8080/api/namespaces/crashlab/pods \
  -H "Authorization: Bearer $OC_API_KEY" \
  -H 'traceparent: 00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01'
kubectl -n kubernetes-openconsole logs deploy/kubernetes-openconsole | grep 4bf92f3577b34da6a3ce929d0e0e4736
```

```json
{"@timestamp":"2026-11-14T11:42:33.628588Z","log":{"level":"info","logger":"http"},"message":"GET /api/namespaces/crashlab/pods 200", … ,"trace":{"id":"4bf92f3577b34da6a3ce929d0e0e4736"}, …}
```

## Jaeger

Jaeger 2 accepts OTLP/HTTP on port 4318 out of the box. A single-pod Jaeger for trying it out (in-memory storage,
nothing kept across restarts):

```yaml title="jaeger.yaml"
apiVersion: v1
kind: Namespace
metadata: {name: observability}
---
apiVersion: apps/v1
kind: Deployment
metadata: {name: jaeger, namespace: observability}
spec:
  selector: {matchLabels: {app: jaeger}}
  template:
    metadata: {labels: {app: jaeger}}
    spec:
      containers:
      - name: jaeger
        image: jaegertracing/jaeger:2.22.0
        ports:
        - {containerPort: 4318, name: otlp-http}
        - {containerPort: 16686, name: ui}
---
apiVersion: v1
kind: Service
metadata: {name: jaeger, namespace: observability}
spec:
  selector: {app: jaeger}
  ports:
  - {name: otlp-http, port: 4318, targetPort: 4318}
  - {name: ui, port: 16686, targetPort: 16686}
```

```bash
kubectl apply -f jaeger.yaml
# set OTEL_EXPORTER_OTLP_ENDPOINT=http://jaeger.observability:4318 as above, use OpenConsole, then:
kubectl -n observability port-forward svc/jaeger 16686 &
curl -s localhost:16686/api/v3/services
# {"services":["openconsole","jaeger"]}  → open http://localhost:16686, Service: openconsole
```

## Grafana Tempo

Point the endpoint at Tempo's distributor, OTLP/HTTP receiver enabled (`distributor.receivers.otlp.protocols.http`):

```yaml
- name: OTEL_EXPORTER_OTLP_ENDPOINT
  value: http://tempo-distributor.monitoring:4318
```

With Grafana Cloud or a Tempo behind authentication, add the header:

```yaml
- name: OTEL_EXPORTER_OTLP_HEADERS
  valueFrom:
    secretKeyRef: {name: openconsole-otlp, key: headers}   # e.g. "Authorization=Basic <base64 user:token>"
```

## Elastic APM

APM Server (or the Elastic Agent APM integration) accepts OTLP/HTTP on its own port, 8200:

```yaml
- name: OTEL_EXPORTER_OTLP_ENDPOINT
  value: https://apm-server.elastic:8200
- name: OTEL_EXPORTER_OTLP_HEADERS
  valueFrom:
    secretKeyRef: {name: openconsole-otlp, key: headers}   # "Authorization=Bearer <secret token>" or "Authorization=ApiKey <key>"
```

The Tempo and Elastic APM settings follow those products' OTLP documentation and were not run for this page; the
Jaeger setup above was. Any receiver that takes OTLP/HTTP works the same way.
