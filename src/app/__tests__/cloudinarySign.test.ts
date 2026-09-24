import { POST as signCloudinary } from '../api/cloudinary/sign/route';
import { getServerSession } from 'next-auth';
import { v2 as cloudinary } from 'cloudinary';

jest.mock('next-auth');
jest.mock('cloudinary', () => ({
  v2: {
    config: jest.fn(),
    utils: {
      api_sign_request: jest.fn().mockReturnValue('mock_sha_signature_123'),
    },
  },
}));

describe('Cloudinary Signing Endpoint Constraints', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.CLOUDINARY_CLOUD_NAME = 'test_cloud';
    process.env.CLOUDINARY_API_KEY = 'test_key';
    process.env.CLOUDINARY_API_SECRET = 'test_secret';
  });

  it('rejects unauthenticated requests with 401', async () => {
    (getServerSession as jest.Mock).mockResolvedValue(null);
    const req = new Request('http://localhost:3000/api/cloudinary/sign', {
      method: 'POST',
      body: JSON.stringify({ folder: 'pdfs' }),
    });

    const res = await signCloudinary(req);
    expect(res.status).toBe(401);
  });

  it('constrains PDF upload signature to pdfs folder, raw resource_type, and 50MB max_file_size', async () => {
    (getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'u1' } });

    const req = new Request('http://localhost:3000/api/cloudinary/sign', {
      method: 'POST',
      body: JSON.stringify({ folder: 'pdfs' }),
    });

    const res = await signCloudinary(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.folder).toBe('pdfs');
    expect(data.resource_type).toBe('raw');
    expect(data.max_file_size).toBe(50 * 1024 * 1024);

    expect(cloudinary.utils.api_sign_request).toHaveBeenCalledWith(
      expect.objectContaining({
        folder: 'pdfs',
      }),
      'test_secret'
    );
  });

  it('rejects upload signature request if requested fileSize exceeds max limit', async () => {
    (getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'u1' } });

    const req = new Request('http://localhost:3000/api/cloudinary/sign', {
      method: 'POST',
      body: JSON.stringify({ folder: 'pdfs', fileSize: 60 * 1024 * 1024 }), // 60MB > 50MB
    });

    const res = await signCloudinary(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain('exceeds maximum allowed limit');
  });

  it('constrains Avatar upload signature to avatars folder, image resource_type, and 5MB max_file_size', async () => {
    (getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'u1' } });

    const req = new Request('http://localhost:3000/api/cloudinary/sign', {
      method: 'POST',
      body: JSON.stringify({ folder: 'avatars' }),
    });

    const res = await signCloudinary(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.folder).toBe('avatars');
    expect(data.resource_type).toBe('image');
    expect(data.max_file_size).toBe(5 * 1024 * 1024);

    expect(cloudinary.utils.api_sign_request).toHaveBeenCalledWith(
      expect.objectContaining({
        folder: 'avatars',
      }),
      'test_secret'
    );
  });
});
