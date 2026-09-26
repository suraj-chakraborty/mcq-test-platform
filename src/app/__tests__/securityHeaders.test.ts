// Test suite to verify enterprise security headers configuration in next.config.js
// eslint-disable-next-line @typescript-eslint/no-var-requires
const nextConfig = require('../../../next.config.js');

describe('Enterprise Security Headers (Step 2)', () => {
  it('defines headers function in next.config.js', () => {
    expect(typeof nextConfig.headers).toBe('function');
  });

  it('configures security headers for all routes (/:path*)', async () => {
    const routeHeaders = await nextConfig.headers();
    expect(Array.isArray(routeHeaders)).toBe(true);

    const globalConfig = routeHeaders.find((r: any) => r.source === '/:path*');
    expect(globalConfig).toBeDefined();

    const headersMap: Record<string, string> = {};
    for (const h of globalConfig.headers) {
      headersMap[h.key] = h.value;
    }

    // 1. Content-Security-Policy
    expect(headersMap['Content-Security-Policy']).toBeDefined();
    expect(headersMap['Content-Security-Policy']).toContain("default-src 'self'");
    expect(headersMap['Content-Security-Policy']).toContain("object-src 'none'");
    expect(headersMap['Content-Security-Policy']).toContain("frame-ancestors 'none'");

    // 2. Strict-Transport-Security (HSTS)
    expect(headersMap['Strict-Transport-Security']).toBeDefined();
    expect(headersMap['Strict-Transport-Security']).toContain('max-age=63072000');
    expect(headersMap['Strict-Transport-Security']).toContain('includeSubDomains');
    expect(headersMap['Strict-Transport-Security']).toContain('preload');

    // 3. X-Content-Type-Options
    expect(headersMap['X-Content-Type-Options']).toBe('nosniff');

    // 4. X-Frame-Options
    expect(headersMap['X-Frame-Options']).toBe('DENY');

    // 5. Referrer-Policy
    expect(headersMap['Referrer-Policy']).toBe('strict-origin-when-cross-origin');

    // 6. Permissions-Policy
    expect(headersMap['Permissions-Policy']).toBeDefined();
    expect(headersMap['Permissions-Policy']).toContain('camera=()');
    expect(headersMap['Permissions-Policy']).toContain('microphone=()');
    expect(headersMap['Permissions-Policy']).toContain('geolocation=()');

    // 7. X-DNS-Prefetch-Control
    expect(headersMap['X-DNS-Prefetch-Control']).toBe('on');
  });
});
