# Use Ubuntu base image
FROM ubuntu:24.04

# Install system dependencies
RUN apt-get update && apt-get install -y \
    python3-pip \
    python3-dev \
    python3-venv \
    curl \
    libgl1-mesa-dev \
    libglu1-mesa-dev \
    libxrender1 \
    libxft2 \
    occt-draw \
    libocct-foundation-7.6t64 \
    libocct-modeling-algorithms-7.6t64 \
    libocct-modeling-data-7.6t64 \
    libocct-ocaf-7.6t64 \
    libocct-visualization-7.6t64 \
    && rm -rf /var/lib/apt/lists/*

# Install poetry system-wide to avoid conflicts
RUN pip3 install --break-system-packages poetry

# Set working directory
WORKDIR /app

# Copy project files from the correct monorepo path
COPY apps/cad-service/pyproject.toml ./pyproject.toml
COPY apps/cad-service/app ./app

# Create virtual environment and install dependencies
RUN python3 -m venv /app/venv \
    && /app/venv/bin/pip install --upgrade pip \
    && /app/venv/bin/pip install fastapi uvicorn pydantic celery redis python-multipart numpy httpx psutil requests structlog \
    && /app/venv/bin/pip install opentelemetry-api opentelemetry-sdk opentelemetry-instrumentation-fastapi \
    && /app/venv/bin/pip install opentelemetry-instrumentation-redis opentelemetry-instrumentation-requests \
    && /app/venv/bin/pip install opentelemetry-exporter-otlp-proto-grpc \
    && /app/venv/bin/pip install pythonocc-core==7.7.2 numpy-stl==3.1.1

# Expose port
EXPOSE 10001

# Run FastAPI with port from environment
CMD /app/venv/bin/uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-10001}
