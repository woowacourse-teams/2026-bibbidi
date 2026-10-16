declare module 'k6/x/sse' {
  interface SseEvent {
    id: string;
    name: string;
    data: string;
  }

  interface SseClient {
    on(type: 'open', handler: () => void): void;
    on(type: 'event', handler: (event: SseEvent) => void): void;
    on(type: 'error', handler: (error: { error(): string }) => void): void;
    close(): void;
  }

  interface SseParams {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
    tags?: Record<string, string>;
  }

  interface SseResponse {
    status: number;
  }

  const sse: {
    open(url: string, params: SseParams, setup: (client: SseClient) => void): SseResponse;
  };

  export default sse;
}
