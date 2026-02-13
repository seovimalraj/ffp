FROM continuumio/miniconda3:latest

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Create env
RUN conda create -n cadenv python=3.10 -y

# Install OCC stack (must be same layer)
RUN conda install -n cadenv -c conda-forge \
    pythonocc-core=7.7.0 \
    numpy \
    scipy \
    scikit-learn \
    -y \
 && conda clean --all -f -y

# pip deps
COPY apps/cad-service/pyproject.toml ./pyproject.toml

RUN /opt/conda/envs/cadenv/bin/pip install --no-cache-dir \
    fastapi uvicorn pydantic celery redis python-multipart \
    httpx psutil requests structlog numpy-stl trimesh==4.0.5 \
    opentelemetry-api opentelemetry-sdk \
    opentelemetry-instrumentation-fastapi \
    opentelemetry-instrumentation-redis \
    opentelemetry-instrumentation-requests \
    opentelemetry-exporter-otlp-proto-grpc

COPY apps/cad-service/app ./app

EXPOSE 10001

CMD ["/opt/conda/envs/cadenv/bin/uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "10001"]
