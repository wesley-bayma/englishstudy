import { NextResponse } from 'next/server';

export type ApiErrorCode =
  | 'INVALID_INPUT'
  | 'AI_NOT_CONFIGURED'
  | 'AUTH_NOT_CONFIGURED'
  | 'AUTH_INVALID'
  | 'RATE_LIMITED'
  | 'CONCURRENCY_LIMITED'
  | 'UPSTREAM_AUTH'
  | 'UPSTREAM_RATE_LIMIT'
  | 'UPSTREAM_TIMEOUT'
  | 'UPSTREAM_ERROR'
  | 'INVALID_AI_RESPONSE'
  | 'INTERNAL_ERROR';

export class ApiServiceError extends Error {
  constructor(
    public readonly code: ApiErrorCode,
    public readonly status: number,
    message: string,
    public readonly upstreamStatus?: number
  ) {
    super(message);
    this.name = 'ApiServiceError';
  }
}

export interface ApiErrorInfo {
  code: ApiErrorCode;
  status: number;
  message: string;
}

export function createRequestId(): string {
  try {
    return globalThis.crypto.randomUUID();
  } catch {
    return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
  }
}

export function getApiErrorInfo(error: unknown): ApiErrorInfo {
  if (error instanceof ApiServiceError) {
    return {
      code: error.code,
      status: error.status,
      message: error.message
    };
  }

  return {
    code: 'INTERNAL_ERROR',
    status: 500,
    message: 'Não foi possível concluir a operação. Tente novamente.'
  };
}

export function apiErrorResponse(requestId: string, error: unknown): NextResponse {
  const info = getApiErrorInfo(error);

  return NextResponse.json(
    {
      error: {
        code: info.code,
        message: info.message,
        requestId
      }
    },
    {
      status: info.status,
      headers: {
        'Cache-Control': 'no-store',
        'X-Request-ID': requestId
      }
    }
  );
}

export function logApiFailure(requestId: string, route: string, error: unknown): void {
  const info = getApiErrorInfo(error);
  console.error(JSON.stringify({
    event: 'api_request_failed',
    requestId,
    route,
    code: info.code,
    status: info.status
  }));
}

export function logAiRequest(input: {
  requestId: string;
  route: string;
  model: string;
  durationMs: number;
  status: number;
  finishReason?: string | null;
}): void {
  console.info(JSON.stringify({
    event: 'ai_request',
    ...input,
    finishReason: input.finishReason ?? null
  }));
}
