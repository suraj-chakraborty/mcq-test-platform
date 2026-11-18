import { POST as mobileCloudinarySignPOST } from '../api/mobile/v1/cloudinary/sign/route';
import { getMobileAuthUser } from '@/app/lib/mobileAuth';
import { v2 as cloudinary } from 'cloudinary';

jest.mock('@/app/lib/mobileAuth', () => ({
  getMobileAuthUser: jest.fn(),
}));

jest.mock('next-auth', () => ({
  getServerSession: jest.fn(),
}));

jest.mock('cloudinary', () => ({
  v2: {
    utils: {
      api_sign_request: jest.fn().mockReturnValue('mock_sha1_signature_hash_12345'),
    },
  },
}));

/**
 * Helper to parse preset avatar strings: preset:id:emoji:colorClass
 */
function parsePresetAvatar(avatarString: string | null | undefined): {
  isPreset: boolean;
  id?: string;
  emoji?: string;
  colorClass?: string;
} {
  if (!avatarString || !avatarString.startsWith('preset:')) {
    return { isPreset: false };
  }

  const parts = avatarString.split(':');
  if (parts.length < 4 || !parts[1] || !parts[2] || !parts[3]) {
    return { isPreset: false };
  }

  return {
    isPreset: true,
    id: parts[1],
    emoji: parts[2],
    colorClass: parts[3],
  };
}

/**
 * Helper to determine MIME type from image filename/URI
 */
function resolveImageMimeType(uriOrFilename: string): string {
  const clean = uriOrFilename.split('?')[0].split('#')[0];
  const filename = clean.split('/').pop() || '';
  const match = /\.(\w+)$/.exec(filename);
  const ext = match ? match[1].toLowerCase() : 'jpg';

  if (ext === 'png') return 'image/png';
  if (ext === 'webp') return 'image/webp';
  return 'image/jpeg';
}

describe('Module 1: Profile Avatar Unit & Cloudinary Signing Suite', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = {
      ...originalEnv,
      CLOUDINARY_CLOUD_NAME: 'test_cloud_name',
      CLOUDINARY_API_KEY: 'test_api_key_123',
      CLOUDINARY_API_SECRET: 'test_api_secret_456',
    };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('Preset Avatar Format Parser', () => {
    it('[P0] parses valid preset avatar strings accurately', () => {
      const parsed = parsePresetAvatar('preset:scholar_male:👨‍🎓:bg-blue-600');
      expect(parsed.isPreset).toBe(true);
      expect(parsed.id).toBe('scholar_male');
      expect(parsed.emoji).toBe('👨‍🎓');
      expect(parsed.colorClass).toBe('bg-blue-600');
    });

    it('[P0] handles various preset emojis and color classes', () => {
      const presets = [
        { raw: 'preset:astronaut:🚀:bg-indigo-600', id: 'astronaut', emoji: '🚀', color: 'bg-indigo-600' },
        { raw: 'preset:wise_owl:🦉:bg-amber-600', id: 'wise_owl', emoji: '🦉', color: 'bg-amber-600' },
        { raw: 'preset:cyber_ninja:⚡:bg-purple-600', id: 'cyber_ninja', emoji: '⚡', color: 'bg-purple-600' },
        { raw: 'preset:champion_lion:🦁:bg-orange-600', id: 'champion_lion', emoji: '🦁', color: 'bg-orange-600' },
      ];

      for (const p of presets) {
        const result = parsePresetAvatar(p.raw);
        expect(result.isPreset).toBe(true);
        expect(result.id).toBe(p.id);
        expect(result.emoji).toBe(p.emoji);
        expect(result.colorClass).toBe(p.color);
      }
    });

    it('[P1] gracefully rejects malformed or truncated preset strings', () => {
      expect(parsePresetAvatar(null).isPreset).toBe(false);
      expect(parsePresetAvatar(undefined).isPreset).toBe(false);
      expect(parsePresetAvatar('').isPreset).toBe(false);
      expect(parsePresetAvatar('https://res.cloudinary.com/pic.jpg').isPreset).toBe(false);
      expect(parsePresetAvatar('preset:').isPreset).toBe(false);
      expect(parsePresetAvatar('preset:scholar_male').isPreset).toBe(false);
      expect(parsePresetAvatar('preset:scholar_male:👨‍🎓').isPreset).toBe(false);
      expect(parsePresetAvatar('preset:::').isPreset).toBe(false);
    });
  });

  describe('Image MIME Type Resolver', () => {
    it('[P0] detects correct MIME types for supported formats', () => {
      expect(resolveImageMimeType('avatar.png')).toBe('image/png');
      expect(resolveImageMimeType('photo.webp')).toBe('image/webp');
      expect(resolveImageMimeType('profile.jpg')).toBe('image/jpeg');
      expect(resolveImageMimeType('profile.jpeg')).toBe('image/jpeg');
      expect(resolveImageMimeType('file:///data/user/0/cache/picker_123.PNG')).toBe('image/png');
      expect(resolveImageMimeType('file:///data/user/0/cache/picker_123.jpg?query=123')).toBe('image/jpeg');
    });

    it('[P1] defaults to image/jpeg when extension is unknown or missing', () => {
      expect(resolveImageMimeType('avatar_file')).toBe('image/jpeg');
      expect(resolveImageMimeType('photo.unknown')).toBe('image/jpeg');
    });
  });

  describe('Pre-Signed Cloudinary Upload Endpoint (POST /api/mobile/v1/cloudinary/sign)', () => {
    const mockUser = {
      id: 'u-cloudinary-student',
      name: 'Cloudinary Tester',
      email: 'test@cloudinary.com',
    };

    it('[P0] generates secure signing params for folder: "avatars"', async () => {
      (getMobileAuthUser as jest.Mock).mockResolvedValue(mockUser);

      const req = new Request('http://localhost:3000/api/mobile/v1/cloudinary/sign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          folder: 'avatars',
        }),
      });

      const res = await mobileCloudinarySignPOST(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.folder).toBe('avatars');
      expect(data.resource_type).toBe('image');
      expect(data.max_file_size).toBe(5 * 1024 * 1024); // 5MB limit for avatars
      expect(data.apiKey).toBe('test_api_key_123');
      expect(data.cloudName).toBe('test_cloud_name');
      expect(data.signature).toBe('mock_sha1_signature_hash_12345');
      expect(typeof data.timestamp).toBe('number');
    });

    it('[P0] enforces 5MB file size limit for avatars and rejects oversized files with 400', async () => {
      (getMobileAuthUser as jest.Mock).mockResolvedValue(mockUser);

      const sixMB = 6 * 1024 * 1024;
      const req = new Request('http://localhost:3000/api/mobile/v1/cloudinary/sign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          folder: 'avatars',
          fileSize: sixMB,
        }),
      });

      const res = await mobileCloudinarySignPOST(req);
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.error).toContain('File size exceeds maximum allowed limit of 5 MB');
    });

    it('[P0] rejects unauthenticated requests with 401', async () => {
      (getMobileAuthUser as jest.Mock).mockResolvedValue(null);

      const req = new Request('http://localhost:3000/api/mobile/v1/cloudinary/sign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folder: 'avatars' }),
      });

      const res = await mobileCloudinarySignPOST(req);
      const data = await res.json();

      expect(res.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('[P1] rejects invalid folders with 400', async () => {
      (getMobileAuthUser as jest.Mock).mockResolvedValue(mockUser);

      const req = new Request('http://localhost:3000/api/mobile/v1/cloudinary/sign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folder: 'unauthorized_folder' }),
      });

      const res = await mobileCloudinarySignPOST(req);
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.error).toContain('Invalid signing parameters');
    });
  });
});
