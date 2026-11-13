---
title: "Quick start (Docker)"
sidebar_label: "Quick start"
description: "Run OpenConsole locally with one docker run."
---

# Quick start (Docker)

```bash
docker run --rm -p 8080:8080 \
  -e TIMEZONE=Europe/Istanbul \
  -v kubernetes-openconsole-data:/data \
  ghcr.io/vurulkan/kubernetes-openconsole:2.22.0
```

The image defaults to `DATA_PATH=/data/app.db` and `STATIC_DIR=/app/public`; the SQLite DB and session recordings live under `/data`. Drop the `-v` for a throwaway instance. Then open http://localhost:8080 and add a cluster ([Connecting clusters](/installation/connect-cluster)).
