import { sanitizeEmailHeader, escapeHtml, sendEmail } from '@/app/lib/send-mail';

describe('Email Security & CRLF Injection Prevention (SEC-008 / Step 2)', () => {
  describe('sanitizeEmailHeader', () => {
    it('accepts clean email addresses and subjects', () => {
      expect(sanitizeEmailHeader('student@example.com', 'recipient')).toBe('student@example.com');
      expect(sanitizeEmailHeader('Your Verification OTP Code', 'subject')).toBe('Your Verification OTP Code');
    });

    it('rejects CRLF injection attempts with \\r\\n in recipient', () => {
      const maliciousRecipient = 'victim@example.com\r\nBcc: attacker@evil.com';
      expect(() => sanitizeEmailHeader(maliciousRecipient, 'recipient')).toThrow(
        /CRLF injection detected in recipient/
      );
    });

    it('rejects newline characters (\\n) in subject', () => {
      const maliciousSubject = 'Account Update\nSubject: Phishing Message';
      expect(() => sanitizeEmailHeader(maliciousSubject, 'subject')).toThrow(
        /CRLF injection detected in subject/
      );
    });

    it('rejects carriage return characters (\\r) in headers', () => {
      const maliciousHeader = 'test@example.com\rX-Spam: No';
      expect(() => sanitizeEmailHeader(maliciousHeader, 'to')).toThrow(
        /CRLF injection detected in to/
      );
    });

    it('rejects null byte injection in headers', () => {
      const nullByteHeader = 'test@example.com\0extra';
      expect(() => sanitizeEmailHeader(nullByteHeader, 'header')).toThrow(
        /CRLF injection detected in header/
      );
    });

    it('rejects non-string or empty header values', () => {
      expect(() => sanitizeEmailHeader('', 'recipient')).toThrow(/Invalid recipient/);
      expect(() => sanitizeEmailHeader(null as any, 'subject')).toThrow(/Invalid subject/);
    });
  });

  describe('escapeHtml', () => {
    it('escapes dangerous HTML/XSS characters', () => {
      const unsafe = '<script>alert("XSS & cookies")</script>';
      const safe = escapeHtml(unsafe);
      expect(safe).toBe('&lt;script&gt;alert(&quot;XSS &amp; cookies&quot;)&lt;/script&gt;');
    });

    it('escapes single quotes', () => {
      expect(escapeHtml("John's Account")).toBe('John&#039;s Account');
    });

    it('handles empty or non-string inputs safely', () => {
      expect(escapeHtml('')).toBe('');
      expect(escapeHtml(null as any)).toBe('');
      expect(escapeHtml(undefined as any)).toBe('');
    });
  });

  describe('sendEmail CRLF validation integration', () => {
    it('rejects sending email when recipient contains CRLF', async () => {
      await expect(
        sendEmail('victim@example.com\r\nBcc: spy@evil.com', 'Subject', 'Text body')
      ).rejects.toThrow(/CRLF injection detected/);
    });

    it('rejects sending email when subject contains CRLF', async () => {
      await expect(
        sendEmail('victim@example.com', 'Subject\r\nInjected: true', 'Text body')
      ).rejects.toThrow(/CRLF injection detected/);
    });
  });
});
