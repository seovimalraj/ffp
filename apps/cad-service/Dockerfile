# Use miniconda base for easier pythonOCC installation
FROM continuumio/miniconda3:24.11.3-0

# Install system dependencies for OpenCASCADE
RUN apt-get update && apt-get install -y \
    curl \
    libgl1-mesa-dev \
    libglu1-mesa-dev \
    libxrender1 \
    libxft2 \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy project files from the correct monorepo path
COPY apps/cad-service/pyproject.toml ./pyproject.toml
COPY apps/cad-service/app ./app

# Create conda environment and install dependencies
# pythonOCC must be installed via conda-forge, not pip
RUN conda create -n cadenv python=3.11 -y \
    && conda install -n cadenv -c conda-forge pythonocc-core=7.7.2 -y \
    && /opt/conda/envs/cadenv/bin/pip install fastapi uvicorn pydantic celery redis python-multipart numpy httpx psutil requests structlog \
    && /opt/conda/envs/cadenv/bin/pip install opentelemetry-api opentelemetry-sdk opentelemetry-instrumentation-fastapi \
    && /opt/conda/envs/cadenv/bin/pip install opentelemetry-instrumentation-redis opentelemetry-instrumentation-requests \
    && /opt/conda/envs/cadenv/bin/pip install opentelemetry-exporter-otlp-proto-grpc \
    && /opt/conda/envs/cadenv/bin/pip install numpy-stl

# Expose port
EXPOSE 10001

# Run FastAPI with conda environment
CMD ["/opt/conda/envs/cadenv/bin/uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "10001"]
