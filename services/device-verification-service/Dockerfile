# Multi-stage build for FastAPI service
FROM python:3.12-slim AS base
WORKDIR /app
ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1

# Dependencies stage - cached unless requirements change
FROM base AS deps
COPY requirements.txt .
RUN pip install --no-cache-dir --user -r requirements.txt

# Production stage
FROM base AS production
ENV PATH=/root/.local/bin:$PATH
COPY --from=deps /root/.local /root/.local
COPY app ./app
EXPOSE 3005
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "3005", "--workers", "4"]

# Development stage (default)
FROM base AS development
COPY --from=deps /root/.local /root/.local
ENV PATH=/root/.local/bin:$PATH
COPY . .
EXPOSE 3005
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "3005", "--reload"]
