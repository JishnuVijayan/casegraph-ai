import { Brief } from '../intake/types';

/** Read-only Brief for the officer. Provided in app.module from the intake BriefService (single implementation). */
export interface BriefReader { briefFor(caseId: string): Promise<Brief> }
export const BRIEF_READER = Symbol('BRIEF_READER');
