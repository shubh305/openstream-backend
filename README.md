# OpenStream Backend — High-Fidelity Streaming Engine

**OpenStream** is a high-performance streaming control plane engineered for real-time media orchestration. Operating as a specialized **Spoke** within the OctaneBrew platform, it manages the full lifecycle of video content—from high-velocity RTMP ingestion to adaptive VOD archival. Built for autonomy and resilience, OpenStream features **Sovereign Authentication**, a split-lane processing DAG, and a persistent WebSocket mesh, ensuring zero-latency engagement independent of the central hub.

## Quick Start

1. **Setup Development Environment**:
   ```bash
   cp .env.example .env
   npm install
   ```
2. **Launch Services**:
   - Master API: `npm run start:dev`
   - Docker: `docker-compose up -d`

3. **Prerequisites**:
   - **Node.js**: v22 or later
   - **MongoDB**: A running instance (local or Atlas)
   - **Kafka**: Broker access (for VOD orchestration)
   - **FFmpeg Worker**: Shared service for transcoding

4. **API Documentation**: Available at `http://localhost:3001/api/docs` (Swagger UI).

## Showcase-Level Architecture
OpenStream is designed for high-throughput media operations:
- **Sovereign Spoke**: Independent JWT validation and autonomous media authorization.
- **Split-Lane DAG**: Parallel processing pipelines for "Fast Lane" (Instant Play) and "Slow Lane" (Quality) transcoding.
- **Event-Driven Core**: Kafka-based orchestration decoupling ingest from processing.

## Technical Documentation Suite

The complete authoritative documentation is available in the `docs` directory:

| Document | Description |
| :--- | :--- |
| [**Architecture**](./docs/architecture.md) | Hub-Spoke design, Sovereign Auth, and Unified Media Flow. |
| [**Backend Deep Dive**](./docs/backend.md) | Ingest flows, TUS integration, and design patterns. |
| [**Operations**](./docs/operations.md) | Containerization, scaling lanes, and environment reference. |
| [**Core Flows**](./docs/flows.md) | Visual sequence diagrams for Ingest, Upload, and Chat. |

---

## Primary Capabilities
- **Smart Upload Pipeline**: Resumable TUS uploads with magic-byte validation and split-lane processing.
- **Live-to-VOD**: Automated recording and transcoding of RTMP streams upon completion.
- **Real-Time Mesh**: High-frequency WebSocket engine for Chat rooms and Pipeline status.
- **Adaptive Bitrate**: Complexity-aware encoding driven by I-Frame analysis.
- **Content Intelligence Layer**:
  - **Clip Highlights**: Automated detection and generation of highlight clips from VOD.
  - **Smart Thumbnail Previews**: FFmpeg-generated sprite extraction mapped for progressive seekbar previews.
  - **AI Summary**: Automated summarization using the OctaneBrew Intelligence service.
  - **Semantic Search**: Text embedding orchestration to locate specific video concepts.
  - **Transcriptions**: Whisper-based automated VTT generation integrated into the slow-lane pipeline.


---

## Testing & Quality
```bash
# Unit Tests
npm test

# E2E Tests
npm run test:e2e

# Linting
npm run lint
```

## API Documentation

Once the app is running, visit:
- **Swagger UI**: `http://localhost:4000/api/docs`
