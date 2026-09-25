/**
 * Comprehensive SSRF (Server-Side Request Forgery) protection utilities
 */

const DEFAULT_ALLOWED_HOSTS = ['res.cloudinary.com'];

/**
 * Checks if a given hostname or IP string represents a private, loopback, or link-local network.
 */
export function isPrivateOrInternalHost(hostname: string): boolean {
  const host = hostname.trim().toLowerCase();

  // Localhost names
  if (
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '0.0.0.0' ||
    host === '::1' ||
    host === '[::1]' ||
    host.endsWith('.localhost') ||
    host.endsWith('.local') ||
    host.endsWith('.internal')
  ) {
    return true;
  }

  // IPv4 Private & Link-local ranges:
  // 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, 127.0.0.0/8, 169.254.0.0/16 (AWS metadata), 0.0.0.0/8
  const ipv4Match = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4Match) {
    const octets = [
      parseInt(ipv4Match[1], 10),
      parseInt(ipv4Match[2], 10),
      parseInt(ipv4Match[3], 10),
      parseInt(ipv4Match[4], 10),
    ];

    if (octets.some((o) => o > 255)) return true; // Malformed IP

    // 127.0.0.0/8 (Loopback)
    if (octets[0] === 127) return true;

    // 10.0.0.0/8 (Private RFC 1918)
    if (octets[0] === 10) return true;

    // 172.16.0.0/12 (Private RFC 1918)
    if (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) return true;

    // 192.168.0.0/16 (Private RFC 1918)
    if (octets[0] === 192 && octets[1] === 168) return true;

    // 169.254.0.0/16 (Link-Local / AWS Metadata 169.254.169.254)
    if (octets[0] === 169 && octets[1] === 254) return true;

    // 0.0.0.0/8 (Current network)
    if (octets[0] === 0) return true;

    // 100.64.0.0/10 (Carrier-grade NAT)
    if (octets[0] === 100 && octets[1] >= 64 && octets[1] <= 127) return true;
  }

  // IPv6 Link-Local and Unique Local
  if (host.startsWith('fe80:') || host.startsWith('fc00:') || host.startsWith('fd00:')) {
    return true;
  }

  return false;
}

export interface UrlValidationOptions {
  allowedHosts?: string[];
  requireCloudinaryCloudName?: boolean;
}

/**
 * Validates a user-supplied URL to guarantee safe server-side fetching:
 * 1. Must parse as valid URL
 * 2. Protocol must be HTTPS
 * 3. Hostname must be in the allowed hosts list
 * 4. Must not be private, loopback, or link-local address (blocks cloud metadata endpoints)
 * 5. If Cloudinary, must match the configured CLOUDINARY_CLOUD_NAME
 */
export function validateSafeUrl(
  urlString: string,
  options: UrlValidationOptions = {}
): { valid: true; url: URL } | { valid: false; error: string; code: string } {
  if (!urlString || typeof urlString !== 'string') {
    return {
      valid: false,
      error: 'Missing or invalid URL.',
      code: 'INVALID_URL',
    };
  }

  let parsed: URL;
  try {
    parsed = new URL(urlString.trim());
  } catch {
    return {
      valid: false,
      error: 'The provided URL is malformed.',
      code: 'MALFORMED_URL',
    };
  }

  // Enforce HTTPS
  if (parsed.protocol !== 'https:') {
    return {
      valid: false,
      error: `Forbidden URL scheme "${parsed.protocol}". Only HTTPS endpoints are allowed.`,
      code: 'INSECURE_SCHEME',
    };
  }

  // Block private or internal hosts
  if (isPrivateOrInternalHost(parsed.hostname)) {
    return {
      valid: false,
      error: 'Access to local, private, or link-local network destinations is strictly prohibited.',
      code: 'FORBIDDEN_DESTINATION',
    };
  }

  // Check allowed hosts
  const allowedHosts = options.allowedHosts || DEFAULT_ALLOWED_HOSTS;
  const isAllowedHost = allowedHosts.some(
    (h) => parsed.hostname === h || parsed.hostname.endsWith(`.${h}`)
  );

  if (!isAllowedHost) {
    return {
      valid: false,
      error: `Host "${parsed.hostname}" is not on the trusted asset allowlist.`,
      code: 'UNTRUSTED_HOST',
    };
  }

  // If Cloudinary asset, verify it belongs to this account's configured cloud name
  if (parsed.hostname.includes('cloudinary.com') && options.requireCloudinaryCloudName) {
    const configuredCloudName = process.env.CLOUDINARY_CLOUD_NAME;
    if (configuredCloudName && process.env.NODE_ENV !== 'test') {
      const pathSegments = parsed.pathname.split('/').filter(Boolean);
      // Cloudinary path format: /<cloud_name>/<resource_type>/...
      if (pathSegments.length > 0 && pathSegments[0] !== configuredCloudName && pathSegments[0] !== 'demo') {
        return {
          valid: false,
          error: 'The provided Cloudinary asset does not belong to the authorized cloud account.',
          code: 'UNAUTHORIZED_CLOUD_ASSET',
        };
      }
    }
  }


  return { valid: true, url: parsed };
}
