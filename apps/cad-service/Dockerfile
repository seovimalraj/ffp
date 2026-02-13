FROM continuumio/miniconda3:latest

SHELL ["/bin/bash", "-c"]

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    libgl1-mesa-glx \
    libglu1-mesa \
    libxrender1 \
    libxi6 \
    libxext6 \
    libfontconfig1 \
    libsm6 \
    libice6 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

RUN conda create -n cadenv python=3.10 -y

RUN conda install -n cadenv -c conda-forge \
    pythonocc-core=7.7.0 \
    numpy \
    scipy \
    scikit-learn \
    -y \
 && conda clean --all -f -y

COPY apps/cad-service/pyproject.toml ./pyproject.toml

RUN conda run -n cadenv pip install --no-cache-dir \
    fastapi uvicorn pydantic celery redis python-multipart \
    httpx psutil requests structlog numpy-stl trimesh==4.0.5 \
    opentelemetry-api opentelemetry-sdk \
    opentelemetry-instrumentation-fastapi \
    opentelemetry-instrumentation-redis \
    opentelemetry-instrumentation-requests \
    opentelemetry-exporter-otlp-proto-grpc

COPY apps/cad-service/app ./app

EXPOSE 10001

CMD ["bash", "-c", "source /opt/conda/etc/profile.d/conda.sh && conda activate cadenv && uvicorn app.main:app --host 0.0.0.0 --port 10001"]
