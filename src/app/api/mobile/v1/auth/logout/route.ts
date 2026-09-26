import { NextResponse } from 'next/server';
import { z } from 'zod';
import { safeJsonParse } from '@/app/lib/validations/common';
import { revokeMobileRefreshToken } from '@/app/lib/mobileAuth';

const logoutSchema = z.object({
  refreshToken: z.string().optional(),
});

export async function POST(req: Request) {
  try {
    const parseResult = await safeJsonParse(req);
    if (parseResult.success) {
      const validation = logoutSchema.safeParse(parseResult.data);
      if (validation.success && validation.data.refreshToken) {
        await revokeMobileRefreshToken(validation.data.refreshToken);
      }
    }

    return NextResponse.json(
      { message: 'Signed out successfully' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Logout error:', error);
    return NextResponse.json(
      { message: 'Signed out successfully' },
      { status: 200 }
    );
  }
}
