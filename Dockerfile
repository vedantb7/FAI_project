# Multi-stage Dockerfile for Modified Wallz full-stack application

# Stage 1: Build React TypeScript frontend
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend

COPY web/frontend/package*.json ./
RUN npm ci

COPY web/frontend ./
RUN npm run build

# Stage 2: Python production runtime
FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

WORKDIR /app

# Install system utilities
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies (CPU-only torch: the demo runs inference on CPU, and the
# default CUDA wheels would add gigabytes to the image)
COPY requirements.txt ./
RUN pip install --no-cache-dir torch --index-url https://download.pytorch.org/whl/cpu \
    && pip install --no-cache-dir -r requirements.txt

# Copy repository code
COPY . .

# Copy compiled frontend distribution from Stage 1
COPY --from=frontend-builder /app/frontend/dist /app/web/frontend/dist

# Run as uid 1000 (required by Hugging Face Spaces); the exact-solver cache must be writable
RUN useradd -m -u 1000 wallz && mkdir -p experiments/cache && chown -R wallz /app
USER wallz

# PORT: 5000 by default, 7860 on Hugging Face Spaces
ENV PORT=5000
EXPOSE 5000 7860

# Start unified Flask server
# Bind to all interfaces inside the container only, so `docker run -p 5000:5000` is reachable.
# Outside Docker the server keeps its 127.0.0.1 default.
CMD ["sh", "-c", "exec python -m web.backend.app --host 0.0.0.0 --port ${PORT}"]
