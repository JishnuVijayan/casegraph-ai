import { SimilarCase } from './types';

/** Contract: submit upserts the case into the case network, then asks for similar cases. */
export interface SimilarCasesProvider {
  findSimilar(caseId: string): Promise<{ status: 'READY' | 'UNAVAILABLE' | 'NONE'; cases: SimilarCase[] }>;
}
export const SIMILAR_CASES_PROVIDER = Symbol('SIMILAR_CASES_PROVIDER');
