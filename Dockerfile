# Stage 1: Build Frontend (Vite)
FROM node:20-alpine AS frontend-builder
WORKDIR /build

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# Stage 2: Backend + Serve Frontend
FROM python:3.13-slim-bookworm
WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/alembic.ini .
COPY backend/migrations ./migrations
COPY backend/app ./app
COPY --from=frontend-builder /build/dist /app/dist

EXPOSE 8000

CMD ["python", "-m", "app.entrypoint"]
