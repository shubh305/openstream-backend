# Operational Guide

## Deployment Strategy

OpenStream is designed to be deployed as a containerized service within the OctaneBrew mesh.

### Docker Deployment
The service utilizes a Multi-Stage Dockerfile to minimize image size and ensure security.

*   **Base**: Node 20-alpine.
*   **Builder**: Installs full dependencies and builds NestJS dist.
*   **Runner**: Production-only dependencies, runs as non-root user (`node`).

```bash
# Build
docker build -t openstream-backend .

# Run
docker run -p 3001:3001 --env-file .env openstream-backend
```

### Scaling Video Processing
The FFmpeg Worker mesh is the most resource-intensive component. It creates a bottleneck if not scaled correctly.

**Strategy: Split-Pooling**
Instead of a monolithic pool, deploy workers with specific **Lane Affinities**:

1.  **Fast Lane Pool**:
    *   **Config**: `PROCESS_LANE=fast`
    *   **Resources**: High CPU, Low Memory.
    *   **Ratio**: 1 Worker per 50 concurrent uploads.
    *   **Goal**: Ensure `vod.transcode.fast` queue is always near-zero.

2.  **Slow Lane Pool**:
    *   **Config**: `PROCESS_LANE=slow`
    *   **Resources**: High CPU, High Memory (for 1080p buffers).
    *   **Ratio**: 1 Worker per 10 concurrent uploads.
    *   **Goal**: Throughput. It's acceptable for this queue to back up.

---

## Environment Variables

| Variable | Description | Required | Default |
| :--- | :--- | :--- | :--- |
| **Core** | | | |
| `PORT` | API Server Port | No | `3001` |
| `NODE_ENV` | Environment (`development`/`production`) | No | `development` |
| **Database** | | | |
| `MONGO_URI` | MongoDB Connection String | Yes | - |
| **Platform** | | | |
| `JWT_SECRET` | Shared secret with Conduit Core | Yes | - |
| `KAFKA_BROKERS`| Kafka Broker List | Yes | `broker:9092` |
| **Storage** | | | |
| `MINIO_ENDPOINT`| MinIO/S3 Host | Yes | `localhost` |
| `MINIO_PORT` | MinIO Port | No | `9000` |
| `MINIO_ROOT_USER`| Access Key | Yes | - |
| `MINIO_ROOT_PASSWORD`| Secret Key | Yes | - |
| `MINIO_BUCKET` | Main Upload Bucket | No | `openstream-uploads` |
| **Uploads** | | | |
| `MAX_UPLOAD_BYTES`| Max File Size (TUS) | No | `5GB` |
| `TUS_CHUNK_SIZE`| Chunk size in MB | No | `5` |
