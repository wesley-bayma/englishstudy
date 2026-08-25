import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { password } = await req.json();
    const correctPassword = process.env.APP_PASSWORD || 'english123';

    if (!password || password !== correctPassword) {
      return NextResponse.json(
        { error: 'Senha incorreta. Tente novamente.' },
        { status: 401 }
      );
    }

    const token = 'hub_auth_' + encodeURIComponent(correctPassword);

    // Set auth cookie valid for 60 days
    const response = NextResponse.json({ success: true, message: 'Autenticado com sucesso' });
    
    response.cookies.set({
      name: 'hub_session_token',
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 60 // 60 days
    });

    return response;
  } catch (error) {
    return NextResponse.json({ error: 'Erro no servidor' }, { status: 500 });
  }
}
