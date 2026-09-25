import crypto from 'crypto';
import { encode, decode } from 'next-auth/jwt';
import { prisma } from './prisma';

const MOBILE_ACCESS_TOKEN_LIFETIME = 15 * 60; // 15 minutes in seconds
const MOBILE_REFRESH_TOKEN_LIFETIME_DAYS = 30; // 30 days

export interface MobileTokenPayload {
  id: string;
  sub: string;
  name: string | null;
  email: string | null;
  picture?: string | null;
}

export interface MobileAuthTokens {
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
}

export function hashRefreshToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function generateRawRefreshToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Creates a short-lived access JWT and a 30-day rotatable refresh token in the database.
 */
export async function createMobileTokens(
  user: {
    id: string;
    email: string | null;
    name: string | null;
    image?: string | null;
  },
  device?: string
): Promise<MobileAuthTokens> {
  const secret = process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET || 'dev_secret_jwt_key_32_characters_long_min!';

  // 1. Generate short-lived access token
  const accessToken = await encode({
    token: {
      id: user.id,
      sub: user.id,
      name: user.name,
      email: user.email,
      picture: user.image,
    },
    secret,
    maxAge: MOBILE_ACCESS_TOKEN_LIFETIME,
  });

  // 2. Generate cryptographically random refresh token & hash it
  const rawRefreshToken = generateRawRefreshToken();
  const tokenHash = hashRefreshToken(rawRefreshToken);

  const expiresAt = new Date(Date.now() + MOBILE_REFRESH_TOKEN_LIFETIME_DAYS * 24 * 60 * 60 * 1000);

  // 3. Persist refresh token hash in database
  await (prisma as any).mobileRefreshToken.create({
    data: {
      userId: user.id,
      tokenHash,
      device: device || 'Android Mobile App',
      expiresAt,
      revoked: false,
    },
  });

  return {
    accessToken,
    refreshToken: rawRefreshToken,
    tokenType: 'Bearer',
    expiresIn: MOBILE_ACCESS_TOKEN_LIFETIME,
  };
}

/**
 * Validates and rotates a mobile refresh token. Revokes the old token and issues a new pair.
 */
export async function rotateMobileRefreshToken(
  rawRefreshToken: string,
  device?: string
): Promise<MobileAuthTokens & { user: { id: string; email: string | null; name: string | null; image?: string | null } }> {
  if (!rawRefreshToken || typeof rawRefreshToken !== 'string') {
    throw new Error('Refresh token is required');
  }

  const tokenHash = hashRefreshToken(rawRefreshToken);

  const existingToken = await (prisma as any).mobileRefreshToken.findUnique({
    where: { tokenHash },
    include: { user: true },
  });

  if (!existingToken) {
    throw new Error('Invalid refresh token');
  }

  if (existingToken.revoked) {
    // If a revoked token is re-used, possible token compromise! Revoke all tokens for this user as a safeguard.
    await (prisma as any).mobileRefreshToken.updateMany({
      where: { userId: existingToken.userId },
      data: { revoked: true },
    });
    throw new Error('Revoked token reuse detected. All sessions terminated.');
  }

  if (new Date() > new Date(existingToken.expiresAt)) {
    throw new Error('Refresh token has expired');
  }

  // Revoke old token
  await (prisma as any).mobileRefreshToken.update({
    where: { id: existingToken.id },
    data: { revoked: true },
  });

  const user = existingToken.user;

  // Issue new token pair
  const tokens = await createMobileTokens(
    {
      id: user.id,
      email: user.email,
      name: user.name,
      image: user.image,
    },
    device || existingToken.device
  );

  return {
    ...tokens,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      image: user.image,
    },
  };
}

/**
 * Revokes a mobile refresh token on sign out.
 */
export async function revokeMobileRefreshToken(rawRefreshToken: string): Promise<boolean> {
  if (!rawRefreshToken || typeof rawRefreshToken !== 'string') {
    return false;
  }

  try {
    const tokenHash = hashRefreshToken(rawRefreshToken);
    await (prisma as any).mobileRefreshToken.updateMany({
      where: { tokenHash },
      data: { revoked: true },
    });
    return true;
  } catch (err) {
    console.error('Error revoking mobile refresh token:', err);
    return false;
  }
}

/**
 * Verifies a Bearer access token and returns the user payload.
 */
export async function verifyAccessToken(token: string): Promise<MobileTokenPayload | null> {
  try {
    const secret = process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET || 'dev_secret_jwt_key_32_characters_long_min!';
    const decoded = await decode({ token, secret });
    if (!decoded || !decoded.id) return null;
    return decoded as unknown as MobileTokenPayload;
  } catch (err) {
    return null;
  }
}

/**
 * Resolves the authenticated user from a Request, supporting both Authorization: Bearer header and NextAuth cookies.
 */
export async function getMobileAuthUser(req: Request) {
  const authHeader = req.headers.get('authorization');
  if (authHeader && authHeader.toLowerCase().startsWith('bearer ')) {
    const token = authHeader.substring(7).trim();
    const payload = await verifyAccessToken(token);
    if (payload?.id) {
      const user = await prisma.user.findUnique({
        where: { id: payload.id },
      });
      return user;
    }
  }

  return null;
}
