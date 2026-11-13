---
title: "Tracing (OpenTelemetry)"
sidebar_label: "Tracing"
description: "OTLP/HTTP traces of API requests."
---

# Tracing (OpenTelemetry)

Off unless an OTLP endpoint is set. Uses the standard OpenTelemetry variables:

- `OTEL_EXPORTER_OTLP_ENDPOINT` (e.g. `http://otel-collector.observability:4318`) or `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT` — OTLP/HTTP receiver. Setting either one turns tracing on.
- `OTEL_SERVICE_NAME` (default `openconsole`), `OTEL_RESOURCE_ATTRIBUTES`, `OTEL_EXPORTER_OTLP_HEADERS` (e.g. an API key), `OTEL_TRACES_SAMPLER` / `OTEL_TRACES_SAMPLER_ARG` (e.g. `parentbased_traceidratio` / `0.1`) — as defined by the OpenTelemetry spec.
- `APP_VERSION` and `APP_ENV` become `service.version` and `deployment.environment`.

Each API request is one span named after its route (`GET /api/namespaces/{namespace}/pods`) with `enduser.id`, `openconsole.cluster` and `openconsole.request_id`; the Kubernetes API calls it made are child spans. Incoming W3C `traceparent` headers are honoured, so a span from your ingress or gateway becomes the parent. Health probes and `/metrics` are not traced, and background informer traffic produces no traces. While tracing is on, every `http.request` log line also carries `trace_id`, so you can jump from a log line to its trace.
