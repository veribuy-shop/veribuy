import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';

export interface TracingConfig {
  serviceName: string;
  serviceVersion?: string;
  jaegerEndpoint?: string;
  environment?: string;
}

export function initTracing(config: TracingConfig): NodeSDK {
  const {
    serviceName,
    serviceVersion = '1.0.0',
    jaegerEndpoint = process.env.JAEGER_ENDPOINT || 'http://localhost:4318',
    environment = process.env.NODE_ENV || 'development',
  } = config;

  // Create resource with service information
  const resource = resourceFromAttributes({
    [ATTR_SERVICE_NAME]: serviceName,
    [ATTR_SERVICE_VERSION]: serviceVersion,
    environment,
  });

  // Configure trace exporter (OTLP HTTP to Jaeger)
  const traceExporter = new OTLPTraceExporter({
    url: `${jaegerEndpoint}/v1/traces`,
  });

  // Configure metrics exporter
  const metricExporter = new OTLPMetricExporter({
    url: `${jaegerEndpoint}/v1/metrics`,
  });

  const metricReader = new PeriodicExportingMetricReader({
    exporter: metricExporter,
    exportIntervalMillis: 15000, // Export every 15 seconds
  });

  // Initialize the SDK
  const sdk = new NodeSDK({
    resource,
    traceExporter,
    metricReader,
    instrumentations: [
      getNodeAutoInstrumentations({
        // Customize instrumentation
        '@opentelemetry/instrumentation-fs': {
          enabled: false, // Disable filesystem instrumentation (too verbose)
        },
        '@opentelemetry/instrumentation-http': {
          enabled: true,
          ignoreIncomingRequestHook: (req) => {
            const path = req.url?.split('?')[0] ?? '';
            return path === '/health' || path === '/metrics';
          },
        },
        '@opentelemetry/instrumentation-express': {
          enabled: true,
        },
        '@opentelemetry/instrumentation-nestjs-core': {
          enabled: true,
        },
        '@opentelemetry/instrumentation-pg': {
          enabled: true,
        },
        '@opentelemetry/instrumentation-redis': {
          enabled: true,
        },
      }),
    ],
  });

  // Start the SDK
  sdk.start();

  // Graceful shutdown
  process.on('SIGTERM', () => {
    sdk
      .shutdown()
      .then(
        () => console.log(`✅ [${serviceName}] OpenTelemetry shut down successfully`),
        (err) => console.error(`❌ [${serviceName}] Error shutting down OpenTelemetry:`, err),
      )
      .finally(() => process.exit(0));
  });

  console.log(`🔍 [${serviceName}] OpenTelemetry tracing initialized`);
  console.log(`📊 [${serviceName}] Exporting to: ${jaegerEndpoint}`);

  return sdk;
}
