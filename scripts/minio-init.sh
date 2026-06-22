#!/bin/bash
# Initializes MinIO bucket and sets public-read policy.
# Run once after first deploy: ./scripts/minio-init.sh
set -e

MINIO_HOST="${MINIO_HOST:-http://localhost:9000}"
MINIO_ALIAS="autolead"
BUCKET="${MINIO_BUCKET:-auto-lead}"
ACCESS_KEY="${MINIO_ACCESS_KEY:-minioadmin}"
SECRET_KEY="${MINIO_SECRET_KEY:-minioadmin}"

echo "==> Configuring MinIO client..."
mc alias set "$MINIO_ALIAS" "$MINIO_HOST" "$ACCESS_KEY" "$SECRET_KEY"

echo "==> Creating bucket: $BUCKET"
mc mb --ignore-existing "$MINIO_ALIAS/$BUCKET"

echo "==> Setting public-read policy on logos prefix..."
mc anonymous set download "$MINIO_ALIAS/$BUCKET/org-logos/"

echo "==> Done. Bucket '$BUCKET' ready."
