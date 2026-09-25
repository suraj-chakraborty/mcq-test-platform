import { validateSafeUrl, isPrivateOrInternalHost } from '@/app/lib/ssrf';
import { downloadCloudinaryPdf } from '@/app/lib/cloudinary';

describe('SSRF Protection & URL Validation (SEC-002 / Step 1)', () => {
  describe('isPrivateOrInternalHost', () => {
    it('identifies localhost and loopback addresses as internal', () => {
      expect(isPrivateOrInternalHost('localhost')).toBe(true);
      expect(isPrivateOrInternalHost('127.0.0.1')).toBe(true);
      expect(isPrivateOrInternalHost('127.100.0.1')).toBe(true);
      expect(isPrivateOrInternalHost('0.0.0.0')).toBe(true);
      expect(isPrivateOrInternalHost('::1')).toBe(true);
      expect(isPrivateOrInternalHost('app.local')).toBe(true);
      expect(isPrivateOrInternalHost('api.internal')).toBe(true);
    });

    it('identifies RFC 1918 private IPv4 ranges as internal', () => {
      expect(isPrivateOrInternalHost('10.0.0.1')).toBe(true);
      expect(isPrivateOrInternalHost('10.254.1.1')).toBe(true);
      expect(isPrivateOrInternalHost('172.16.0.1')).toBe(true);
      expect(isPrivateOrInternalHost('172.31.255.255')).toBe(true);
      expect(isPrivateOrInternalHost('192.168.1.1')).toBe(true);
      expect(isPrivateOrInternalHost('192.168.0.254')).toBe(true);
    });

    it('identifies cloud metadata service (169.254.169.254) as internal', () => {
      expect(isPrivateOrInternalHost('169.254.169.254')).toBe(true);
      expect(isPrivateOrInternalHost('169.254.1.1')).toBe(true);
    });

    it('identifies carrier-grade NAT addresses as internal', () => {
      expect(isPrivateOrInternalHost('100.64.0.1')).toBe(true);
      expect(isPrivateOrInternalHost('100.127.255.255')).toBe(true);
    });

    it('allows public external hostnames', () => {
      expect(isPrivateOrInternalHost('res.cloudinary.com')).toBe(false);
      expect(isPrivateOrInternalHost('api.google.com')).toBe(false);
      expect(isPrivateOrInternalHost('example.com')).toBe(false);
    });
  });

  describe('validateSafeUrl', () => {
    it('rejects empty, null, or malformed inputs', () => {
      expect(validateSafeUrl('').valid).toBe(false);
      expect(validateSafeUrl('not-a-valid-url').valid).toBe(false);
    });

    it('rejects non-HTTPS schemes (HTTP, FTP, file, gopher)', () => {
      const httpResult = validateSafeUrl('http://res.cloudinary.com/demo/test.pdf');
      expect(httpResult.valid).toBe(false);
      if (!httpResult.valid) {
        expect(httpResult.code).toBe('INSECURE_SCHEME');
      }

      const fileResult = validateSafeUrl('file:///etc/passwd');
      expect(fileResult.valid).toBe(false);
      if (!fileResult.valid) {
        expect(fileResult.code).toBe('INSECURE_SCHEME');
      }

      const ftpResult = validateSafeUrl('ftp://res.cloudinary.com/test.pdf');
      expect(ftpResult.valid).toBe(false);
      if (!ftpResult.valid) {
        expect(ftpResult.code).toBe('INSECURE_SCHEME');
      }
    });

    it('blocks loopback and cloud metadata requests even over https', () => {
      const metaResult = validateSafeUrl('https://169.254.169.254/latest/meta-data/');
      expect(metaResult.valid).toBe(false);
      if (!metaResult.valid) {
        expect(metaResult.code).toBe('FORBIDDEN_DESTINATION');
      }

      const localResult = validateSafeUrl('https://localhost:8443/secret');
      expect(localResult.valid).toBe(false);
      if (!localResult.valid) {
        expect(localResult.code).toBe('FORBIDDEN_DESTINATION');
      }
    });

    it('rejects untrusted external domains not in allowed hosts', () => {
      const untrusted = validateSafeUrl('https://evil-attacker.com/exploit.pdf');
      expect(untrusted.valid).toBe(false);
      if (!untrusted.valid) {
        expect(untrusted.code).toBe('UNTRUSTED_HOST');
      }
    });

    it('accepts legitimate HTTPS Cloudinary URLs', () => {
      const valid = validateSafeUrl('https://res.cloudinary.com/demo/raw/upload/sample.pdf');
      expect(valid.valid).toBe(true);
      if (valid.valid) {
        expect(valid.url.hostname).toBe('res.cloudinary.com');
      }
    });
  });

  describe('downloadCloudinaryPdf SSRF defense', () => {
    it('refuses to fetch from an untrusted domain', async () => {
      await expect(
        downloadCloudinaryPdf('https://attacker-controlled-server.com/fake.pdf')
      ).rejects.toThrow(/SSRF validation failed/);
    });

    it('refuses to fetch from AWS metadata endpoint', async () => {
      await expect(
        downloadCloudinaryPdf('https://169.254.169.254/latest/meta-data/')
      ).rejects.toThrow(/SSRF validation failed/);
    });

    it('refuses to fetch via HTTP scheme', async () => {
      await expect(
        downloadCloudinaryPdf('http://res.cloudinary.com/demo/image/upload/sample.pdf')
      ).rejects.toThrow(/SSRF validation failed/);
    });
  });
});
