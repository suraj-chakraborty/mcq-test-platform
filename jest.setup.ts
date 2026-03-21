import '@testing-library/jest-dom';
// Polyfill Web APIs for API Route testing (since node-fetch/whatwg-fetch are missing)
if (typeof global.Headers === 'undefined') {
  global.Headers = class Headers {
    private _headers = new Map<string, string>();
    constructor(init?: any) {
      if (init) {
        if (Array.isArray(init)) {
          init.forEach(([k, v]) => this._headers.set(k.toLowerCase(), v));
        } else if (init instanceof Headers) {
          (init as any).forEach((v: string, k: string) => this._headers.set(k, v));
        } else {
          Object.entries(init).forEach(([k, v]) => this._headers.set(k.toLowerCase(), String(v)));
        }
      }
    }
    append(k: string, v: string) { this._headers.set(k.toLowerCase(), v); }
    get(k: string) { return this._headers.get(k.toLowerCase()) || null; }
    has(k: string) { return this._headers.has(k.toLowerCase()); }
    forEach(cb: (v: string, k: string) => void) { this._headers.forEach(cb); }
  } as any;
}

if (typeof global.Request === 'undefined') {
  global.Request = class Request {
    public url: string;
    public method: string;
    public headers: any;
    private _body: any;
    constructor(input: any, init: any = {}) {
      this.url = typeof input === 'string' ? input : input.url;
      this.method = init.method || 'GET';
      this.headers = new global.Headers(init.headers);
      this._body = init.body;
    }
    async json() { return typeof this._body === 'string' ? JSON.parse(this._body) : this._body; }
    async text() { return String(this._body); }
  } as any;
}

if (typeof global.Response === 'undefined') {
  global.Response = class Response {
    public status: number;
    public ok: boolean;
    public headers: any;
    private _body: any;
    constructor(body?: any, init: any = {}) {
      this.status = init.status || 200;
      this.ok = this.status >= 200 && this.status < 300;
      this.headers = new global.Headers(init.headers);
      this._body = body;
    }
    async json() { return typeof this._body === 'string' ? JSON.parse(this._body) : this._body; }
    async text() { return String(this._body); }
    static json(data: any, init: any = {}) {
      const res = new Response(JSON.stringify(data), {
        ...init,
        headers: { 'Content-Type': 'application/json', ...init.headers }
      });
      // Ensure the instance actually has the data for our polyfill's json() method
      (res as any)._body = data; 
      return res;
    }
  } as any;
}

// Mock NextResponse for Next.js API consistency
jest.mock('next/server', () => ({
  NextResponse: {
    json: (data: any, init: any) => {
      const res = new global.Response(JSON.stringify(data), init);
      (res as any)._body = data;
      (res as any).headers.set('Content-Type', 'application/json');
      return res;
    }
  }
}), { virtual: true });

// Mock ResizeObserver for Radix UI
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};
