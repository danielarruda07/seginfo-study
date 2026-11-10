import { describe, expect, it } from 'vitest';
import { decryptJSON, deriveKey, encryptJSON, randomBytes } from './crypto';

describe('vault cryptography', () => {
  it('round-trips data and rejects a different master password', async () => {
    const salt = randomBytes(16);
    const key = await deriveKey('correct horse battery staple', salt);
    const encrypted = await encryptJSON({ title: 'lab note', secret: 'opaque' }, key, salt);
    expect(await decryptJSON(encrypted, key)).toEqual({ title: 'lab note', secret: 'opaque' });
    const wrongKey = await deriveKey('incorrect phrase', salt);
    await expect(decryptJSON(encrypted, wrongKey)).rejects.toThrow();
  });
});
