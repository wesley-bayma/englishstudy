import { NextRequest, NextResponse } from 'next/server';
import { ApiServiceError, apiErrorResponse, createRequestId, logApiFailure } from '../../../../lib/api-errors';
import { assertAllowedFields, parseJsonBody, requiredString } from '../../../../lib/api-validation';
import { checkRateLimit } from '../../../../lib/rate-limit';
import { getClientAddress } from '../../../../lib/api-validation';
import { createSessionToken, getAuthConfig, SESSION_MAX_AGE } from '../../../../lib/session';

export async function POST(req: NextRequest) {
  const requestId = createRequestId();
  try {
    const rateLimit = checkRateLimit(`login:${getClientAddress(req)}`, 5, 15 * 60_000);
    if (!rateLimit.allowed) {
      return NextResponse.json({ error: { code: 'RATE_LIMITED', message: 'Muitas tentativas. Tente novamente mais tarde.', requestId } }, {
        status: 429,
        headers: { 'Retry-After': String(rateLimit.retryAfterSeconds), 'Cache-Control': 'no-store' }
      });
    }

    const authConfig = getAuthConfig();
    if (!authConfig) {
      throw new ApiServiceError('AUTH_NOT_CONFIGURED', 503, 'A autenticação ainda não está configurada.');
    }

    const body = await parseJsonBody(req, 2048);
    assertAllowedFields(body, ['password']);
    const password = requiredString(body, 'password', { max: 256 });

    if (password !== authConfig.password) {
      return NextResponse.json(
        { error: { code: 'AUTH_INVALID', message: 'Senha incorreta. Tente novamente.', requestId } },
        { status: 401, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    const token = await createSessionToken(authConfig.sessionSecret);

    // Set auth cookie valid for 60 days
    const response = NextResponse.json({ success: true, message: 'Autenticado com sucesso' });
    
    response.cookies.set({
      name: 'hub_session_token',
      value: token,
      httpOnly: true,
      secure: req.nextUrl.protocol === 'https:' || req.headers.get('x-forwarded-proto') === 'https',
      sameSite: 'lax',
      path: '/',
      maxAge: SESSION_MAX_AGE
    });

    return response;
  } catch (error: unknown) {
    logApiFailure(requestId, '/api/auth/login', error);
    return apiErrorResponse(requestId, error);
  }
}
