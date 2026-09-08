import { ApiServiceError } from './api-errors';
import type { ContentType } from './types';

const CONTENT_TYPES: ContentType[] = [
  'vocabulary',
  'survival_phrase',
  'phrasal_verb',
  'personal_phrase',
  'personal_vocabulary'
];

export async function parseJsonBody(req: Request, maxBytes = 16_384): Promise<Record<string, unknown>> {
  const contentLength = Number(req.headers.get('content-length') || 0);
  if (contentLength > maxBytes) {
    throw new ApiServiceError('INVALID_INPUT', 413, 'A requisição excede o tamanho permitido.');
  }

  let raw: string;
  try {
    raw = await req.text();
  } catch {
    throw new ApiServiceError('INVALID_INPUT', 400, 'Corpo da requisição inválido.');
  }

  if (raw.length > maxBytes) {
    throw new ApiServiceError('INVALID_INPUT', 413, 'A requisição excede o tamanho permitido.');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new ApiServiceError('INVALID_INPUT', 400, 'Envie um JSON válido.');
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new ApiServiceError('INVALID_INPUT', 400, 'O corpo da requisição deve ser um objeto JSON.');
  }

  return parsed as Record<string, unknown>;
}

export function assertAllowedFields(body: Record<string, unknown>, fields: string[]): void {
  const allowed = new Set(fields);
  const unknown = Object.keys(body).find(key => !allowed.has(key));
  if (unknown) {
    throw new ApiServiceError('INVALID_INPUT', 400, `Campo não permitido: ${unknown}.`);
  }
}

export function requiredString(
  body: Record<string, unknown>,
  field: string,
  options: { min?: number; max: number }
): string {
  const value = body[field];
  if (typeof value !== 'string') {
    throw new ApiServiceError('INVALID_INPUT', 400, `O campo ${field} é obrigatório.`);
  }

  const clean = value.trim();
  const min = options.min ?? 1;
  if (clean.length < min || clean.length > options.max) {
    throw new ApiServiceError('INVALID_INPUT', 400, `O campo ${field} tem tamanho inválido.`);
  }

  return clean;
}

export function optionalString(
  body: Record<string, unknown>,
  field: string,
  max: number
): string {
  const value = body[field];
  if (value === undefined || value === null) return '';
  if (typeof value !== 'string' || value.length > max) {
    throw new ApiServiceError('INVALID_INPUT', 400, `O campo ${field} tem formato inválido.`);
  }
  return value.trim();
}

export function optionalStringArray(
  body: Record<string, unknown>,
  field: string,
  options: { maxItems: number; maxItemLength: number }
): string[] {
  const value = body[field];
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value) || value.length > options.maxItems) {
    throw new ApiServiceError('INVALID_INPUT', 400, `O campo ${field} tem formato inválido.`);
  }

  if (value.some(item => typeof item !== 'string' || item.trim().length > options.maxItemLength)) {
    throw new ApiServiceError('INVALID_INPUT', 400, `O campo ${field} tem conteúdo inválido.`);
  }

  return value.map(item => (item as string).trim());
}

export function optionalContentType(body: Record<string, unknown>, field: string): ContentType | undefined {
  const value = body[field];
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value !== 'string' || !CONTENT_TYPES.includes(value as ContentType)) {
    throw new ApiServiceError('INVALID_INPUT', 400, `O campo ${field} tem um tipo inválido.`);
  }
  return value as ContentType;
}

export function getClientAddress(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return (forwarded || req.headers.get('x-real-ip') || 'unknown').slice(0, 128);
}
