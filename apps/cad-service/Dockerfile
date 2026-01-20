# Use miniconda base for easier pythonOCC installation
FROM continuumio/miniconda3:latest

# Install system dependencies (minimal)
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

# Set working directory
WORKDIR /app

# Create conda environment FIRST (better caching)
RUN conda create -n cadenv python=3.11 -y \
    && conda install -n cadenv -c conda-forge pythonocc-core=7.7.2 numpy -y \
    && conda clean --all -f -y

# Copy requirements and install pip packages
COPY apps/cad-service/pyproject.toml ./pyproject.toml
RUN /opt/conda/envs/cadenv/bin/pip install --no-cache-dir \
    fastapi uvicorn pydantic celery redis python-multipart \
    httpx psutil requests structlog numpy-stl trimesh==4.0.5 \
    opentelemetry-api opentelemetry-sdk opentelemetry-instrumentation-fastapi \
    opentelemetry-instrumentation-redis opentelemetry-instrumentation-requests \
    opentelemetry-exporter-otlp-proto-grpc

# Copy application code LAST (for better layer caching)
COPY apps/cad-service/app ./app

# Expose port
EXPOSE 10001

# Run FastAPI with conda environment
CMD ["/opt/conda/envs/cadenv/bin/uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "10001"]
