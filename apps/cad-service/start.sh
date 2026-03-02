#!/bin/bash

# Start the CAD service
cd /workspaces/cnc-quote/apps/cad-service

# Install dependencies if needed
pip install -r requirements.txt

# Start the FastAPI server
uvicorn main:app --host 0.0.0.0 --port 8001 --reload
