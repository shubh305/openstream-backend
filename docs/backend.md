# Backend Technical Reference

## Technology Stack

*   **Framework**: [NestJS](https://nestjs.com/) (Modular, TypeScript-based Node.js framework).
*   **Language**: TypeScript 5.x.
*   **Database**: MongoDB (via Mongoose).
*   **Messaging**: Apache Kafka (via `kafkajs`).
*   **Real-Time**: Socket.IO & Native WebSockets.
*   **Storage**: MinIO (S3 Compatible).

---

## Deep Dive: Ingest & Upload Flows

### 1. The Ingest Flow (RTMP)
This flow handles the complexity of mapping a physical RTMP connection to a logical User Stream.

*   **Entry**: `nginx-rtmp` receives a TCP connection on port 1935.
*   **Auth**: It makes a blocking HTTP POST to the backend's `StreamsController`.
*   **Session**: If authorized, Nginx maintains the socket. It writes FLV tags to the disk.
*   **HLS Generation**: Simultaneously, Nginx uses `ffmpeg` (exec) to slice the FLV into TS segments for live playback.
*   **Closure**: On disconnect, Nginx finalizes the FLV file and notifies the backend, which triggers the "Live-to-VOD" migration.

### 2. The Smart Upload Flow (TUS + Kafka)
This flow decouples "File Transfer" from "File Processing".

*   **TUS Layer**:
    *   The `TusMiddleware` acts as a specialized HTTP handler.
    *   It intercepts `POST`, `PATCH`, and `HEAD` requests to `/api/vod-upload/tus`.
    *   It manages `.info` metadata files and binary `.bin` chunks in MinIO.
*   **Kafka Producer**:
    *   Once TUS reports `onUploadFinish`, we immediately extract metadata (Filename, Size, User).
    *   We construct a `VodTranscodePayload` and fire it into the Kafka topic.
    *   We do **not** process video in the HTTP request thread. This ensures the API remains responsive.

---

## Design Patterns

### Repository Pattern
We abstract all database access behind **Repositories** (`UsersRepository`, `StreamsRepository`).
*   **Benefit**: Decouples business logic from Mongoose intricacies. Allows for easy mocking in unit tests.

### Gateway Pattern
Real-time logic is encapsulated in **Gateways** (`VodSocketGateway`, `ChatGateway`).
*   **Benefit**: Separates WebSocket event handling from REST controllers.

### Event-Driven Architecture (EDA)
Long-running tasks (Transcoding) are handled asynchronously via **Kafka Events**.
*   **Benefit**: Resilience. If the Worker Service crashes, messages persist in Kafka until it recovers. No data is lost.

---

## Directory Structure

```text
.
├── src/
│   ├── auth/          # JWT & Platform Authentication
│   ├── chat/          # WebSocket
│   ├── stream/        # RTMP Webhooks & Authorization
│   ├── vod/           # Archival & Media Management
│   ├── main.ts        # Entry point & Swagger Init
│   └── app.module.ts  # Central Dependency Hub
├── test/              # E2E & Unit Test Suites
├── docker-compose.yml # Local Dev Infrastructure
└── package.json       # Dependencies & Scripts
```
