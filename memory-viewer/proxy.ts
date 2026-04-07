import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, COOKIE_NAME } from '@/lib/auth';

async function isAuthenticated(request: NextRequest): Promise<boolean> {
  const token = request.cookies.get(COOKIE_NAME)?.value;
  if (!token) return false;
  return verifyToken(token);
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 정적 파일 및 인증 API는 통과
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.startsWith('/api/auth/')
  ) {
    return NextResponse.next();
  }

  const authed = await isAuthenticated(request);

  // /login 페이지: 이미 로그인된 경우 홈으로 리다이렉트
  if (pathname === '/login') {
    if (authed) return NextResponse.redirect(new URL('/', request.url));
    return NextResponse.next();
  }

  // API 라우트: 미인증 시 401 반환 (페이지 리다이렉트 X)
  if (pathname.startsWith('/api/')) {
    if (!authed) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.next();
  }

  // 나머지 페이지: 미인증 시 /login으로 리다이렉트
  if (!authed) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon\\.ico).*)'],
};
