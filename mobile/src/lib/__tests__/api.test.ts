import { request, setOnSessionExpired } from '../api';
import { clearTokens } from '../tokens';

jest.mock('../tokens', () => ({
  clearTokens: jest.fn(),
  getAccessToken: jest.fn().mockResolvedValue('expired'),
  getRefreshToken: jest.fn().mockResolvedValue('refresh'),
  saveTokens: jest.fn(),
}));

const expired = { ok: false, status: 401, statusText: 'Unauthorized', headers: { get: () => null } };

describe('session handling', () => {
  const onExpired = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    setOnSessionExpired(onExpired);
  });

  it('stays signed in when the refresh fails on a dropped connection', async () => {
    global.fetch = jest.fn().mockResolvedValueOnce(expired).mockRejectedValueOnce(new TypeError('Network request failed'));
    await expect(request('/orders')).rejects.toBeDefined();
    expect(clearTokens).not.toHaveBeenCalled();
    expect(onExpired).not.toHaveBeenCalled();
  });

  it('stays signed in when the refresh hits a server error', async () => {
    global.fetch = jest.fn().mockResolvedValueOnce(expired).mockResolvedValueOnce({ ok: false, status: 503 });
    await expect(request('/orders')).rejects.toBeDefined();
    expect(clearTokens).not.toHaveBeenCalled();
    expect(onExpired).not.toHaveBeenCalled();
  });

  it('ends the session when the server rejects the refresh', async () => {
    global.fetch = jest.fn().mockResolvedValueOnce(expired).mockResolvedValueOnce({ ok: false, status: 401 });
    await expect(request('/orders')).rejects.toBeDefined();
    expect(clearTokens).toHaveBeenCalled();
    expect(onExpired).toHaveBeenCalled();
  });
});
