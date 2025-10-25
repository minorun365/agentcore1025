# Multi-stage build for Strands Agent on Bedrock AgentCore Runtime
# Platform: ARM64 (required by AgentCore)
FROM --platform=linux/arm64 python:3.12-slim-bookworm

WORKDIR /app

# Install system dependencies
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Set Python environment variables
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# Copy requirements and install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Create non-root user for security
RUN useradd -m -u 1000 agentcore && \
    chown -R agentcore:agentcore /app
USER agentcore

# Copy application code
COPY --chown=agentcore:agentcore agent.py .

# Expose port 8080 (AgentCore Runtime requirement)
EXPOSE 8080

# Run with OpenTelemetry instrumentation for CloudWatch observability
CMD ["opentelemetry-instrument", "python", "agent.py"]
