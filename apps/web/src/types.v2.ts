// v2 shared types. Mirrors docs/V2_CONTRACT.md. Do not edit without updating the contract.
export type CategoryId =
  | 'upi_payment_fraud' | 'investment_scam' | 'job_or_task_scam' | 'loan_app_harassment'
  | 'phishing_or_kyc' | 'sextortion_blackmail' | 'romance_scam' | 'account_hacking'
  | 'online_shopping' | 'impersonation' | 'online_harassment' | 'identity_theft' | 'malware_or_ransomware' | 'fake_profile' | 'other';
export type EntityKind = 'phone' | 'upi' | 'bank_account' | 'url' | 'email' | 'person_name' | 'app_name' | 'ifsc' | 'social_handle';
export type CaseStatus = 'DRAFT' | 'SUBMITTED';
export type Money = { amount: number; currency: 'INR' };
export type Entity = { kind: EntityKind; value: string };
export type TimelineItem = {
  id: string; at: string | null; atLabel: string; precision: 'EXACT' | 'APPROXIMATE' | 'DATE_ONLY' | 'UNKNOWN';
  title: string; detail: string; kind: 'contact' | 'payment' | 'account_action' | 'other';
  sources: { type: 'FILE' | 'STORY' | 'AI'; evidenceId?: string; label: string }[];
};
export type Fact = {
  id: string; label: string; value: string; group: 'money' | 'people' | 'channels' | 'accounts' | 'time' | 'other';
  source: 'FILE' | 'STORY' | 'AI'; evidenceId?: string;
};
export type Question = { id: string; prompt: string; why: string; status: 'OPEN' | 'ANSWERED' | 'UNKNOWN'; answer?: string; options?: string[] };
export type EvidenceItem = {
  id: string; name: string; mime: string; sizeBytes: number; sha256: string;
  kind: 'image' | 'document'; readStatus: 'PENDING' | 'READ' | 'FAILED'; excerpt?: string;
};
export type Narrative = { id: string; text: string; channel: 'typed' | 'voice'; createdAt: string };
export type Brief = {
  caseId: string; reference: string; status: CaseStatus; category: CategoryId; categoryLabel: string;
  title: string; summary: string; totalLoss: Money | null;
  completeness: { percent: number; missing: string[] };
  timeline: TimelineItem[]; facts: Fact[]; entities: Entity[]; questions: Question[];
  evidence: EvidenceItem[]; narratives: Narrative[];
  analysis: { state: 'IDLE' | 'RUNNING' | 'READY' | 'FAILED'; updatedAt: string | null };
};
export type CaseListItem = {
  id: string; reference: string; title: string; categoryLabel: string; status: CaseStatus;
  updatedAt: string; completenessPercent: number;
};
export type SharedEntity = { kind: EntityKind; value: string; strength: 'STRONG' | 'WEAK' };
export type SimilarCase = {
  caseId: string; reference: string; category: CategoryId; categoryLabel: string; title: string; summary: string;
  loss: Money | null; submittedAt: string; score: number; shared: SharedEntity[]; reason: string;
};
export type SimilarCases = { status: 'READY' | 'UNAVAILABLE' | 'NONE'; cases: SimilarCase[] };
export type OfficerCaseRow = {
  id: string; reference: string; title: string; category: CategoryId; categoryLabel: string;
  victimName: string; victimMobileMasked: string; loss: Money | null; submittedAt: string;
  similarCount: number; completenessPercent: number;
};
export type OfficerCaseFile = { brief: Brief; victim: { name: string; mobile: string }; similar: SimilarCases };
export type SubmitResult = { reference: string; status: 'SUBMITTED'; similarCases: { status: SimilarCases['status']; count: number } };
export type Session = { token: string; user: { id: string; role: 'victim' | 'analyst'; displayName: string } };
export const CATEGORIES: { id: CategoryId; label: string; hint: string }[] = [
  { id: 'upi_payment_fraud', label: 'UPI / payment fraud', hint: 'Money sent by UPI, bank transfer or card to a fraudster' },
  { id: 'investment_scam', label: 'Investment / trading scam', hint: 'Fake trading apps, crypto or high-return schemes' },
  { id: 'job_or_task_scam', label: 'Job / task scam', hint: 'Fake jobs, paid tasks, part-time work offers' },
  { id: 'loan_app_harassment', label: 'Loan app / harassment', hint: 'Illegal loan apps, threats, contact leaks' },
  { id: 'phishing_or_kyc', label: 'Phishing / fake KYC', hint: 'Fake bank calls, links, KYC or OTP theft' },
  { id: 'sextortion_blackmail', label: 'Sextortion / blackmail', hint: 'Threats using private photos or videos' },
  { id: 'romance_scam', label: 'Romance / friendship scam', hint: 'Someone you met online asked for money' },
  { id: 'account_hacking', label: 'Account hacking', hint: 'Social media, email or wallet taken over' },
  { id: 'online_shopping', label: 'Online shopping fraud', hint: 'Paid for goods that never came' },
  { id: 'impersonation', label: 'Impersonation', hint: 'Pretending to be police, courier or an official' },
  { id: 'online_harassment', label: 'Harassment, stalking or threats', hint: 'Abuse, bullying, stalking or threats online' },
  { id: 'identity_theft', label: 'Identity theft / data misuse', hint: 'Someone used your documents, SIM or personal data' },
  { id: 'malware_or_ransomware', label: 'Virus, ransomware or hacked device', hint: 'Harmful apps or files, locked files, remote access' },
  { id: 'fake_profile', label: 'Fake profile or false posts', hint: 'Fake accounts in your name, false or morphed content' },
  { id: 'other', label: 'Another cyber crime', hint: 'Anything else that happened online' },
];
