# OpenStream Backend

OpenStream Backend is a NestJS application that acts as the control plane for a live streaming platform. It manages authentication, video processing, and VOD archival, working in conjunction with an external `Nginx-RTMP` ingest service.

## Architecture

This service operates in **Passive Controller Mode**:
1.  **Ingestion**: Handled by an external Nginx-RTMP service (Infrastructure).
2.  **Auth Delegation**: Nginx sends `on_publish` webhooks to this backend to validate stream keys.
3.  **VOD Processing**: Nginx sends `on_record_done` webhooks when a stream ends. The backend then:
    *   Finds the recorded file (via shared volume).
    *   Generates thumbnails.
    *   Logs the VOD to MongoDB.

## Prerequisites

*   **Docker** and **Docker Compose**
*   **Node.js 20+** (for local dev)
*   **MongoDB** (if running locally without Docker)

## Installation

```bash
git clone <repo-url>
cd openstream-backend
npm install
```

## Environment Configuration

Create a `.env` file based on `.env.example`:

```bash
cp .env.example .env
```

**Required Variables:**
*   `MONGO_URI`: Connection string for MongoDB.
*   `JWT_SECRET`: Secret key for signing tokens.

## Running with Docker (Recommended)

The application is designed to run in a containerized environment, attached to the `octane-net` network to communicate with the Ingest Service.

```bash
# Build and start the service
docker-compose up -d --build
```

**Note:** Ensure the `octane-net` network exists (usually created by the Platform Infrastructure repo).
```bash
docker network create octane-net || true
```

## Running Locally (Development)

1.  **Start MongoDB** (Ensure it's running locally or accessible).
2.  **Run the App**:
    ```bash
    npm run start:dev
    ```
3.  **Access API Docs**: Open [http://localhost:3000/api](http://localhost:3000/api).

## API Documentation

The API provides comprehensive Swagger documentation at `/api`.

*   **Auth**: Sign up, Login, Profile.
*   **Streams**: Webhooks (`on_publish`, `on_record_done`) and Ingest Config.
*   **VODs**: List archived streams.

## Testing

*   **E2E Tests**: `npm run test:e2e`
*   **Lint**: `npm run lint`
