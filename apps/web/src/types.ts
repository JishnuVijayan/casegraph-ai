export type Identity = { id: string; displayName: string; role: 'victim' | 'analyst' };
export type CaseSummary = { id: string; title: string; status: string; category?: string; synthetic: true };
export type CaseDetail = CaseSummary & { category: string };
export type Session = { token: string; user: Identity };
