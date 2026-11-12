import { describe, expect, it } from 'vitest';
import { getPixPollingDelay } from './pixPolling';

describe('getPixPollingDelay', () => {
  it('verifica a cada 3 segundos no primeiro minuto', () => {
    expect(getPixPollingDelay(0)).toBe(3_000);
    expect(getPixPollingDelay(59_999)).toBe(3_000);
  });

  it('verifica a cada 6 segundos até completar 3 minutos', () => {
    expect(getPixPollingDelay(60_000)).toBe(6_000);
    expect(getPixPollingDelay(179_999)).toBe(6_000);
  });

  it('verifica a cada 10 segundos depois de 3 minutos', () => {
    expect(getPixPollingDelay(180_000)).toBe(10_000);
    expect(getPixPollingDelay(720_000)).toBe(10_000);
  });
});
