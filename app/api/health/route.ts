import { NextResponse } from 'next/server';
import { getAuthConfig } from '../../../lib/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const ready = Boolean(process.env.OPENROUTER_API_KEY && getAuthConfig());
  const response = NextResponse.json({
    status: ready ? 'ok' : 'degraded',
    release: process.env.VERCEL_GIT_COMMIT_SHA || 'local',
    timestamp: new Date().toISOString()
  }, { status: ready ? 200 : 503 });
  response.headers.set('Cache-Control', 'no-store');
  return response;
}
