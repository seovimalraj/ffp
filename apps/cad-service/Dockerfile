# ===========================================================================
# Stage 1: Builder — install all conda/pip packages into a packed environment
# ===========================================================================
FROM continuumio/miniconda3:24.1.2-0 AS builder
SHELL ["/bin/bash", "-c"]
ENV DEBIAN_FRONTEND=noninteractive

RUN conda create -n cadenv python=3.10 -y

RUN conda install -n cadenv -c conda-forge \
    pythonocc-core=7.7.0 \
    occt=7.7.0 \
    rtree \
    numpy \
    scipy \
    scikit-learn \
    conda-pack \
    -y \
 && conda clean --all -f -y

RUN conda run -n cadenv pip install --no-cache-dir \
    fastapi uvicorn pydantic celery redis python-multipart \
    httpx psutil requests structlog numpy-stl trimesh==4.0.5 \
    opentelemetry-api opentelemetry-sdk \
    opentelemetry-instrumentation-fastapi \
    opentelemetry-instrumentation-redis \
    opentelemetry-instrumentation-requests \
    opentelemetry-exporter-otlp-proto-grpc

# Pack the conda environment into a self-contained tarball
RUN conda-pack -n cadenv -o /tmp/cadenv.tar.gz --ignore-editable-packages

# ===========================================================================
# Stage 2: Slim runtime — no conda overhead (~500-800 MB smaller image)
# ===========================================================================
FROM debian:bookworm-slim
SHELL ["/bin/bash", "-c"]
ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 \
    libglu1-mesa \
    libspatialindex-dev \
    libjemalloc2 \
    && rm -rf /var/lib/apt/lists/*

# Use jemalloc to reduce memory fragmentation from repeated large
# alloc/free cycles (OCC shapes, NumPy arrays). Returns memory to
# the OS more aggressively than glibc malloc.
ENV LD_PRELOAD=/usr/lib/x86_64-linux-gnu/libjemalloc.so.2
ENV MALLOC_CONF="background_thread:true,dirty_decay_ms:1000,muzzy_decay_ms:1000"

# Unpack the conda environment
RUN mkdir -p /opt/cadenv
COPY --from=builder /tmp/cadenv.tar.gz /opt/cadenv/cadenv.tar.gz
RUN cd /opt/cadenv && tar -xzf cadenv.tar.gz && rm cadenv.tar.gz \
    && /opt/cadenv/bin/conda-unpack 2>/dev/null || true

WORKDIR /app

COPY apps/cad-service/app ./app

EXPOSE 10001

# --limit-concurrency 5: cap concurrent connections (prevents OOM from parallel STEP analyses)
# --limit-max-requests 1000: restart worker after 1000 requests to reclaim leaked memory
CMD ["/opt/cadenv/bin/python", "-m", "uvicorn", "app.main:app", \
     "--host", "0.0.0.0", "--port", "10001", \
     "--limit-concurrency", "5", \
     "--limit-max-requests", "1000"]

# ---------- Base Image ----------
# FROM continuumio/miniconda3:24.1.2-0

# ENV DEBIAN_FRONTEND=noninteractive
# WORKDIR /app

# # ---------- System Dependencies ----------
# RUN apt-get update && apt-get install -y --no-install-recommends \
#     libgl1 \
#     libglu1-mesa \
#     libspatialindex-dev \
#     build-essential \
#     && rm -rf /var/lib/apt/lists/*

# # ---------- Create Conda Environment ----------
# RUN conda create -n cadenv python=3.10 -y

# # Activate conda env for all future RUN commands
# SHELL ["conda", "run", "-n", "cadenv", "/bin/bash", "-c"]

# # ---------- Install Conda Packages ----------
# RUN conda install -c conda-forge \
#     pythonocc-core=7.7.0 \
#     occt=7.7.0 \
#     rtree \
#     numpy \
#     scipy \
#     scikit-learn \
#     -y \
#  && conda clean --all -f -y

# # ---------- Install Pip Packages ----------
# RUN pip install --no-cache-dir \
#     fastapi \
#     uvicorn[standard] \
#     pydantic \
#     celery \
#     redis \
#     python-multipart \
#     httpx \
#     psutil \
#     requests \
#     structlog \
#     numpy-stl \
#     trimesh==4.0.5 \
#     opentelemetry-api \
#     opentelemetry-sdk \
#     opentelemetry-instrumentation-fastapi \
#     opentelemetry-instrumentation-redis \
#     opentelemetry-instrumentation-requests \
#     opentelemetry-exporter-otlp-proto-grpc

# # ---------- Copy Application ----------
# COPY app ./app

# EXPOSE 10001

# # ---------- Start Application ----------
# CMD ["conda", "run", "--no-capture-output", "-n", "cadenv", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "10001"]