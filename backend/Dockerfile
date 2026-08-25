# Stage 1: Build React Frontend
FROM node:20-alpine AS frontend-builder
WORKDIR /frontend
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm install
COPY frontend/ .
RUN npm run build

# Stage 2: Python FastAPI Backend + Static Frontend
FROM python:3.11-slim
WORKDIR /app

# Install system dependencies for OCR
RUN apt-get update && apt-get install -y tesseract-ocr && rm -rf /var/lib/apt/lists/*

# Install python dependencies first for better caching
COPY backend/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend application files
COPY backend/ .

# Copy built frontend into static folder for FastAPI to serve directly
COPY --from=frontend-builder /frontend/dist ./static

# Run FastAPI on dynamic port (defaults to 8000 if not set by Railway)
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
