const { getAccountEnv } = require('../fetchAllEmails');

describe('getAccountEnv', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  test('returns value for index 1 from numbered variable', () => {
    process.env.EMAIL_USER1 = 'first';
    process.env.EMAIL_USER = 'fallback';
    expect(getAccountEnv('EMAIL_USER', 1)).toBe('first');
  });

  test('falls back to unnumbered variable when index 1 missing', () => {
    delete process.env.EMAIL_USER1;
    process.env.EMAIL_USER = 'fallback';
    expect(getAccountEnv('EMAIL_USER', 1)).toBe('fallback');
  });

  test('returns numbered variable for index > 1', () => {
    process.env.EMAIL_USER3 = 'third';
    expect(getAccountEnv('EMAIL_USER', 3)).toBe('third');
  });
});
