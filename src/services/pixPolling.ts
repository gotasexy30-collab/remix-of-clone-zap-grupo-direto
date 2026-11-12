/**
 * Intervalos graduais para consultar o status de um PIX.
 * O primeiro minuto prioriza a confirmação rápida; depois reduz chamadas.
 */
export function getPixPollingDelay(elapsedMs: number): number {
  if (elapsedMs < 60_000) return 3_000;
  if (elapsedMs < 180_000) return 6_000;
  return 10_000;
}
