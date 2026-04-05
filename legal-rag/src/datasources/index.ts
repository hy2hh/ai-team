/**
 * DataSource 모듈
 *
 * 현재 구현된 어댑터:
 * - aihub: AI Hub 법률 데이터셋 (9,000건)
 * - lbox-open: LBox Open 판결문 (150,000건)
 * - lawnet: 법망 API - 대법원 판례 (50,000건+)
 *
 * 향후 확장:
 * - lbox-partner: 엘박스 파트너십 API (200만건)
 */

export * from './interface.js';
export type { DataSource } from '../types/legal-document.js';
export { AIHubAdapter } from './aihub-adapter.js';
export { LboxOpenAdapter } from './lbox-open-adapter.js';
export { LawNetAdapter } from './lawnet-adapter.js';

import { DataSourceRegistry } from './interface.js';
import { AIHubAdapter } from './aihub-adapter.js';
import { LboxOpenAdapter } from './lbox-open-adapter.js';
import { LawNetAdapter } from './lawnet-adapter.js';

/**
 * 기본 어댑터 등록
 */
export function registerDefaultAdapters(): DataSourceRegistry {
  const registry = DataSourceRegistry.getInstance();

  registry.register('aihub', async () => new AIHubAdapter());
  registry.register('lbox-open', async () => new LboxOpenAdapter());
  registry.register('lawnet', async () => new LawNetAdapter());

  return registry;
}
