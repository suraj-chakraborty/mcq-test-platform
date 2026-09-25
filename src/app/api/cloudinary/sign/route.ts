import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import { v2 as cloudinary } from 'cloudinary';
import { z } from 'zod';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const signRequestSchema = z
  .object({
    folder: z.enum(['avatars', 'pdfs']).optional().default('pdfs'),
    fileSize: z.number().int().positive().optional(),
  })
  .strict();

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;

    if (!cloudName || !apiKey || !apiSecret) {
      return NextResponse.json(
        { error: 'Cloudinary credentials are not configured on server' },
        { status: 500 }
      );
    }

    let body: any = { folder: 'pdfs' };
    const text = await req.text();
    if (text && text.trim().length > 0) {
      let parsedJson: any;
      try {
        parsedJson = JSON.parse(text);
      } catch (e) {
        return NextResponse.json(
          { error: 'Invalid JSON in request body', code: 'MALFORMED_JSON' },
          { status: 400 }
        );
      }
      const validation = signRequestSchema.safeParse(parsedJson);
      if (!validation.success) {
        return NextResponse.json(
          { error: 'Invalid signing parameters: folder must be "avatars" or "pdfs"', details: validation.error.format() },
          { status: 400 }
        );
      }
      body = validation.data;
    }

    const isAvatar = body?.folder === 'avatars';
    const folder = isAvatar ? 'avatars' : 'pdfs';
    const resource_type = isAvatar ? 'image' : 'raw';
    const max_file_size = isAvatar ? 5 * 1024 * 1024 : 50 * 1024 * 1024; // 5MB for avatars, 50MB for PDFs
    const timestamp = Math.round(new Date().getTime() / 1000);

    // Validate client-reported fileSize upfront if provided
    if (body?.fileSize && typeof body.fileSize === 'number' && body.fileSize > max_file_size) {
      return NextResponse.json(
        { error: `File size exceeds maximum allowed limit of ${max_file_size / (1024 * 1024)} MB` },
        { status: 400 }
      );
    }

    // Sign the exact upload parameters sent to Cloudinary REST API
    const paramsToSign: Record<string, any> = {
      folder,
      timestamp,
    };

    const signature = cloudinary.utils.api_sign_request(paramsToSign, apiSecret);

    return NextResponse.json({
      success: true,
      signature,
      timestamp,
      apiKey,
      cloudName,
      folder,
      resource_type,
      max_file_size,
    });
  } catch (error) {
    console.error('Error creating Cloudinary upload signature:', error);
    return NextResponse.json({ error: 'Failed to generate upload signature' }, { status: 500 });
  }
}
