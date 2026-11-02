import { evidenceService } from '../index';

jest.mock('expo-file-system', () => ({
  File: class {
    async bytes() {
      return new Uint8Array();
    }
  },
}));
jest.mock('../../lib/api', () => ({
  api: { form: jest.fn().mockResolvedValue({ id: 'item-1' }) },
}));

describe('evidence upload', () => {
  it('attaches a real file, because the Expo fetch rejects React Native { uri } parts', async () => {
    const append = jest.spyOn(FormData.prototype, 'append');

    await evidenceService.upload(
      'listing-1',
      { uri: 'file:///photo.png', name: 'evidence.jpg', type: 'image/jpeg' },
      { type: 'DEVICE_IMAGE' },
    );

    const part = append.mock.calls.find(([name]) => name === 'file')?.[1] as unknown as Record<string, unknown>;
    expect(typeof part.bytes).toBe('function');
    expect(part.uri).toBeUndefined();
  });
});
