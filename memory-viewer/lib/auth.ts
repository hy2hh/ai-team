import { SignJWT, jwtVerify } from 'jose';

export const COOKIE_NAME = 'memory-viewer-auth';

function getSecret(): Uint8Array {
  return new TextEncoder().encode(
    process.env.MEMORY_VIEWER_JWT_SECRET || 'memory-viewer-secret-key-change-in-prod'
  );
}

export async function signToken(): Promise<string> {
  return new SignJWT({ authenticated: true })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(getSecret());
}

export async function verifyToken(token: string): Promise<boolean> {
  try {
    await jwtVerify(token, getSecret());
    return true;
  } catch {
    return false;
  }
}
