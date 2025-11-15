FROM node:22-alpine AS builder

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm ci

COPY . .

RUN npm run build

FROM node:22-alpine

WORKDIR /usr/src/app

# Install FFmpeg for video processing
RUN apk add --no-cache ffmpeg

COPY package*.json ./

RUN npm ci --only=production

COPY --from=builder /usr/src/app/dist ./dist

# Create media directory for recordings
RUN mkdir -p /usr/src/app/media/recordings

EXPOSE 4000

CMD ["node", "dist/main"]
