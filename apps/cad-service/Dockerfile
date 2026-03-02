FROM continuumio/miniconda3:24.1.2-0
SHELL ["/bin/bash", "-c"]
ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 \
    libglu1-mesa \
    libspatialindex-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

RUN conda create -n cadenv python=3.10 -y

RUN conda install -n cadenv -c conda-forge \
    pythonocc-core=7.7.0 \
    occt=7.7.0 \
    rtree \
    numpy \
    scipy \
    scikit-learn \
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

COPY apps/cad-service/app ./app

EXPOSE 10001

CMD ["conda","run","--no-capture-output","-n","cadenv","uvicorn","app.main:app","--host","0.0.0.0","--port","10001"]

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