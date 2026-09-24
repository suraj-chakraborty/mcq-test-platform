import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import { v2 as cloudinary } from 'cloudinary';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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

    const body = await req.json().catch(() => ({}));
    const isAvatar = body?.folder === 'avatars';
    const folder = isAvatar ? 'avatars' : 'pdfs';
    const resource_type = isAvatar ? 'image' : 'raw';
    const max_file_size = isAvatar ? 5 * 1024 * 1024 : 50 * 1024 * 1024; // 5MB for avatars, 50MB for PDFs
    const timestamp = Math.round(new Date().getTime() / 1000);

    // Sign the upload parameters for direct client upload with strict security constraints
    const paramsToSign: Record<string, any> = {
      folder,
      timestamp,
      max_file_size,
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
