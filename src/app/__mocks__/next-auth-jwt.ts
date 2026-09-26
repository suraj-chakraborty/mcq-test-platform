export const getToken = jest.fn();
export const encode = jest.fn().mockImplementation(async ({ token }) => {
  return `mock.jwt.${Buffer.from(JSON.stringify(token || {})).toString('base64url')}`;
});
export const decode = jest.fn().mockImplementation(async ({ token }) => {
  if (!token) return null;
  if (token.startsWith('mock.jwt.')) {
    const b64 = token.replace('mock.jwt.', '');
    return JSON.parse(Buffer.from(b64, 'base64url').toString('utf8'));
  }
  return { id: 'mock_decoded_id', sub: 'mock_decoded_id' };
});

