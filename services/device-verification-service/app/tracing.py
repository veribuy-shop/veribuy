"""OpenTelemetry tracing configuration for device-verification-service."""

import os
from opentelemetry import trace
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
from opentelemetry.sdk.resources import Resource
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
from opentelemetry.instrumentation.httpx import HTTPXClientInstrumentor

# Configuration
JAEGER_ENDPOINT = os.getenv("JAEGER_ENDPOINT", "http://localhost:4318")
SERVICE_NAME = "device-verification-service"
SERVICE_VERSION = "1.0.0"

# Create resource with service information
resource = Resource(attributes={
    "service.name": SERVICE_NAME,
    "service.version": SERVICE_VERSION,
})

# Configure tracer provider
tracer_provider = TracerProvider(resource=resource)

# Configure OTLP exporter
otlp_exporter = OTLPSpanExporter(
    endpoint=f"{JAEGER_ENDPOINT}/v1/traces",
)

# Add span processor
span_processor = BatchSpanProcessor(otlp_exporter)
tracer_provider.add_span_processor(span_processor)

# Set global tracer provider
trace.set_tracer_provider(tracer_provider)

# Get tracer for manual instrumentation
tracer = trace.get_tracer(__name__)

print(f"🔍 [{SERVICE_NAME}] OpenTelemetry tracing initialized")
print(f"📊 [{SERVICE_NAME}] Exporting to: {JAEGER_ENDPOINT}")


def instrument_app(app):
    """Instrument FastAPI application with OpenTelemetry."""
    # Auto-instrument FastAPI
    FastAPIInstrumentor.instrument_app(app)
    
    # Auto-instrument HTTPX (for external API calls)
    HTTPXClientInstrumentor().instrument()
    
    print(f"✅ [{SERVICE_NAME}] FastAPI and HTTPX instrumented")
