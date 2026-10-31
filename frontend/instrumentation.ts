// Node-only instrumentation lives in instrumentation-node.ts so the Edge
// bundle never pulls in Node built-ins (crypto, net).
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { registerNodeFetchInstrumentation } = await import('./instrumentation-node');
    await registerNodeFetchInstrumentation();
  }
}
