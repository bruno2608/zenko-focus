import { beforeAll, beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { uploadAttachment } from '../api';
import * as offline from '../../../lib/offline';

vi.mock('../../../lib/supabase', () => ({
  OFFLINE_USER_ID: 'offline-user',
  isOfflineMode: vi.fn(() => true),
  supabase: {
    from: vi.fn(),
    storage: {
      from: vi.fn(() => ({
        upload: vi.fn(),
        getPublicUrl: vi.fn(() => ({ data: { publicUrl: '' } }))
      }))
    }
  }
}));

describe('offline attachments', () => {
  const estimateMock = vi.fn();

  beforeAll(() => {
    if (typeof navigator === 'undefined') {
      (globalThis as any).navigator = {};
    }
    if (!URL.createObjectURL) {
      URL.createObjectURL = () => 'blob:mock-url';
    }
  });

  beforeEach(() => {
    estimateMock.mockReset();
    (navigator as any).storage = { estimate: estimateMock };
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete (navigator as any).storage;
  });

  it('rejeita anexos quando a estimativa de armazenamento indica falta de espaço', async () => {
    estimateMock.mockResolvedValue({ quota: 1024, usage: 1020 });
    vi.spyOn(offline, 'readOffline').mockResolvedValueOnce([]);
    const writeSpy = vi.spyOn(offline, 'writeOffline');

    const file = new File([new Uint8Array(10)], 'relatorio.txt', { type: 'text/plain' });

    await expect(uploadAttachment(file)).rejects.toThrow('Espaço de armazenamento offline insuficiente');
    expect(writeSpy).not.toHaveBeenCalled();
  });

  it('apresenta erro amigável quando IndexedDB lança QuotaExceededError', async () => {
    estimateMock.mockResolvedValue({ quota: 5 * 1024 * 1024, usage: 0 });
    vi.spyOn(offline, 'readOffline').mockResolvedValueOnce([]);
    const quotaError = new offline.OfflineStorageError('Limite', 'quota_exceeded');
    const writeSpy = vi.spyOn(offline, 'writeOffline').mockRejectedValueOnce(quotaError);

    const file = new File([new Uint8Array(100)], 'apresentacao.pdf', { type: 'application/pdf' });

    await expect(uploadAttachment(file)).rejects.toThrow('Espaço de armazenamento offline insuficiente');
    expect(writeSpy).toHaveBeenCalledTimes(1);
  });
});
