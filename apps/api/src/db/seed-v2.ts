import { Database } from './connection';
import { loadFixtures } from './fixtures';
import { caseAccessGrants, caseAnalyses, cases, claims, eventClaims, narratives, timelineEvents, users } from './schema';

/**
 * ~40 FICTIONAL submitted complaints for the officer inbox and the case network.
 * Names, numbers, UPI IDs and sites are invented (reserved ".example" domains, fictional handles).
 * Clusters share entities on purpose; some overlaps are weak/benign; some complaints stand alone.
 */
type Cat = 'upi_payment_fraud' | 'investment_scam' | 'job_or_task_scam' | 'loan_app_harassment' | 'phishing_or_kyc' | 'sextortion_blackmail' | 'romance_scam' | 'account_hacking' | 'online_shopping' | 'impersonation' | 'other';
type Spec = { cat: Cat; name: string; mobile: string; loss: number; days: number; what: string; ents: [string, string][] };

const PH = { jobTg: '+91 90000 11111', inv: '90000 22222', shop: '9000033333', loan: '+919000044444', kyc: '90000 55555', courier: '9000066666', romance: '9000077777', sext: '9000088888' };
export const SEED_SPECS: Spec[] = [
  // Cluster A: task/job scam run from one Telegram number and one UPI ID (3 strong + 1 UPI-only)
  { cat: 'job_or_task_scam', name: 'Anita Thomas', mobile: '9000100001', loss: 48500, days: 24, what: 'a part-time "like and review" job offered on Telegram; paid small amounts first, then asked to deposit for premium tasks', ents: [['phone', PH.jobTg], ['upi_id', 'taskhr.desk@okfictbank'], ['app_name', 'Telegram']] },
  { cat: 'job_or_task_scam', name: 'Rohit Nair', mobile: '9000100002', loss: 125000, days: 19, what: 'a work-from-home rating job; was told to add money to unlock withdrawal of earnings', ents: [['phone', '09000011111'], ['upi_id', 'TaskHR.Desk@okfictbank'], ['app_name', 'Telegram']] },
  { cat: 'job_or_task_scam', name: 'Meera Pillai', mobile: '9000100003', loss: 32000, days: 12, what: 'a YouTube-like task job; each "level" needed a larger deposit', ents: [['phone', '9000011111'], ['upi_id', 'taskhr.desk@okfictbank'], ['social_handle', '@careers_fastpay']] },
  { cat: 'job_or_task_scam', name: 'Sanjay Kurup', mobile: '9000100004', loss: 15000, days: 9, what: 'a data-entry job that asked for a registration fee', ents: [['upi_id', 'taskhr.desk@okfictbank'], ['email', 'hr@fastpay-careers.example']] },
  // Cluster B: fake trading website + shared receiving account
  { cat: 'investment_scam', name: 'Deepa Varma', mobile: '9000100005', loss: 410000, days: 27, what: 'a trading app promising 3x returns; the website showed fake profits and blocked withdrawal', ents: [['url', 'https://www.tradepro-global.example/login'], ['bank_account', '5010 0000 1234 56'], ['ifsc', 'FICT0000123'], ['person_name', 'Mr Arjun Rao']] },
  { cat: 'investment_scam', name: 'Faisal Khan', mobile: '9000100006', loss: 220000, days: 21, what: 'an IPO allotment group on WhatsApp that moved to a trading site', ents: [['url', 'tradepro-global.example'], ['bank_account', '501000001234 56'], ['phone', PH.inv]] },
  { cat: 'investment_scam', name: 'Lakshmi Iyer', mobile: '9000100007', loss: 75000, days: 14, what: 'a stock tips channel pushing a crypto trading platform', ents: [['url', 'http://TradePro-Global.example/app'], ['phone', '+91 90000 22222']] },
  { cat: 'investment_scam', name: 'George Mathew', mobile: '9000100008', loss: 530000, days: 6, what: 'a "VIP fund manager" who guided deposits into a fake platform', ents: [['url', 'tradepro-global.example'], ['bank_account', '50100000123456'], ['person_name', 'Arjun Rao']] },
  // Cluster C: online shopping page with one handle (+ phone shared by two)
  { cat: 'online_shopping', name: 'Nisha Das', mobile: '9000100009', loss: 6499, days: 17, what: 'a discounted sports shoe ordered from an Instagram page; nothing was delivered', ents: [['social_handle', '@dealsbazaar_x'], ['phone', PH.shop], ['upi_id', 'dealsbazaar@okfictpay']] },
  { cat: 'online_shopping', name: 'Imran Sheikh', mobile: '9000100010', loss: 3200, days: 11, what: 'a phone cover and earbuds combo that never arrived; seller blocked the buyer', ents: [['social_handle', 'https://instagram.com/dealsbazaar_x'], ['phone', '9000033333']] },
  { cat: 'online_shopping', name: 'Preethi Raj', mobile: '9000100011', loss: 9800, days: 4, what: 'a saree order paid by UPI; parcel tracking was fake', ents: [['social_handle', '@dealsbazaar_x'], ['upi_id', 'dealsbazaar@okfictpay']] },
  // Cluster D: loan app harassment (2 strong via phone; 3rd only the app name, weak)
  { cat: 'loan_app_harassment', name: 'Vikram Bhat', mobile: '9000100012', loss: 8000, days: 20, what: 'a small instant loan app; agents sent threatening messages to contacts after repayment', ents: [['phone', PH.loan], ['app_name', 'QuickCash Lite']] },
  { cat: 'loan_app_harassment', name: 'Sunita Gowda', mobile: '9000100013', loss: 12000, days: 13, what: 'forced to repay several times the loan; morphed photos threatened', ents: [['phone', '+91 90000 44444'], ['app_name', 'quickcash lite']] },
  { cat: 'loan_app_harassment', name: 'Hari Prasad', mobile: '9000100014', loss: 5000, days: 7, what: 'harassing calls from collectors of a loan app', ents: [['app_name', 'QuickCash Lite']] },
  // Cluster E: fake bank KYC calls/SMS
  { cat: 'phishing_or_kyc', name: 'Kavitha Menon', mobile: '9000100015', loss: 87000, days: 23, what: 'a caller said the bank account would be blocked unless KYC was updated via a link; OTP was shared', ents: [['phone', PH.kyc], ['email', 'kyc-help@securebank-support.example'], ['url', 'securebank-kyc-update.example']] },
  { cat: 'phishing_or_kyc', name: 'Ravi Shankar', mobile: '9000100016', loss: 23000, days: 15, what: 'an SMS with a KYC link; card details entered on the page', ents: [['url', 'https://securebank-kyc-update.example/verify'], ['phone', '9000055555']] },
  { cat: 'phishing_or_kyc', name: 'Jasmine Paul', mobile: '9000100017', loss: 41000, days: 3, what: 'a call from a fake bank officer asking to install a remote-access app', ents: [['email', 'KYC-Help@securebank-support.example'], ['app_name', 'AnyDesk']] },
  // Cluster F: courier/police impersonation
  { cat: 'impersonation', name: 'Mohan Lal', mobile: '9000100018', loss: 250000, days: 22, what: 'a "courier" call about a parcel with illegal items, then a video call by a fake officer asking for a settlement', ents: [['phone', PH.courier], ['person_name', 'Inspector Vijay Kumar'], ['upi_id', 'settlement.desk@okfictbank']] },
  { cat: 'impersonation', name: 'Aisha Begum', mobile: '9000100019', loss: 310000, days: 8, what: 'told she was under "digital arrest"; asked to transfer funds for verification', ents: [['phone', '90000 66666'], ['upi_id', 'settlement.desk@okfictbank']] },
  // Cluster G: romance/friendship scam
  { cat: 'romance_scam', name: 'Tessa Joseph', mobile: '9000100020', loss: 180000, days: 26, what: 'an online friend abroad promised a gift parcel and then asked for customs fees', ents: [['social_handle', '@daniel_hart_official'], ['phone', PH.romance], ['upi_id', 'customsfee@okfictpay']] },
  { cat: 'romance_scam', name: 'Padmini Rao', mobile: '9000100021', loss: 96000, days: 10, what: 'a dating app match who needed emergency money for a medical bill', ents: [['social_handle', 'daniel_hart_official'], ['upi_id', 'customsfee@okfictpay']] },
  // Cluster H: sextortion
  { cat: 'sextortion_blackmail', name: 'Anil Kumar', mobile: '9000100022', loss: 30000, days: 18, what: 'a video call that was recorded and used to demand money', ents: [['phone', PH.sext], ['social_handle', '@priya.chat.live']] },
  { cat: 'sextortion_blackmail', name: 'Rahul Menon', mobile: '9000100023', loss: 15000, days: 5, what: 'blackmail after an intimate video call with a stranger', ents: [['phone', '+919000088888']] },
  // Account hacking (shares only a weak/benign overlap with others)
  { cat: 'account_hacking', name: 'Shruti Hegde', mobile: '9000100024', loss: 0, days: 25, what: 'WhatsApp account taken over after sharing a six-digit code with a "friend"', ents: [['app_name', 'WhatsApp'], ['phone', '9000099901']] },
  { cat: 'account_hacking', name: 'Dev Patel', mobile: '9000100025', loss: 0, days: 16, what: 'email and social accounts accessed after a phishing link', ents: [['app_name', 'WhatsApp'], ['email', 'recover.support@mailbox-help.example']] },
  { cat: 'account_hacking', name: 'Nandini Sen', mobile: '9000100026', loss: 2000, days: 2, what: 'Instagram account hijacked and used to ask friends for money', ents: [['social_handle', '@nandini.sen.official'], ['app_name', 'Instagram']] },
  // Weak overlaps across unrelated categories: same common name and the same chat app
  { cat: 'upi_payment_fraud', name: 'Ritu Singh', mobile: '9000100027', loss: 9000, days: 21, what: 'paid a stranger by mistake after a fake "refund" request; payment collect request approved by error', ents: [['upi_id', 'refund.assist@okfictpay'], ['person_name', 'Rahul Sharma']] },
  { cat: 'upi_payment_fraud', name: 'Mathew Chacko', mobile: '9000100028', loss: 14500, days: 12, what: 'a QR code sent for "receiving" money, which instead debited the account', ents: [['upi_id', 'qrpay.helper@okfictbank'], ['phone', '9000099902']] },
  { cat: 'upi_payment_fraud', name: 'Zainab Ali', mobile: '9000100029', loss: 5600, days: 1, what: 'a buyer on a classifieds site asked to scan a QR to receive payment', ents: [['upi_id', 'olx.buyer77@okfictpay'], ['person_name', 'rahul sharma']] },
  { cat: 'job_or_task_scam', name: 'Arun Mohan', mobile: '9000100030', loss: 7500, days: 15, what: 'a registration fee for a promised overseas job that never materialised', ents: [['person_name', 'Rahul Sharma'], ['app_name', 'Telegram']] },
  { cat: 'investment_scam', name: 'Bindu Chandran', mobile: '9000100031', loss: 60000, days: 11, what: 'a chit-fund style scheme sold through a relative; the organiser stopped responding', ents: [['phone', '9000099903'], ['person_name', 'Suresh Babu']] },
  // Stand-alone complaints (no overlaps)
  { cat: 'other', name: 'Gopal Krishnan', mobile: '9000100032', loss: 0, days: 14, what: 'abusive anonymous messages on a social platform', ents: [['social_handle', '@anon_troll_7781']] },
  { cat: 'online_shopping', name: 'Sheela Dsouza', mobile: '9000100033', loss: 2899, days: 9, what: 'a wrong, counterfeit product delivered; seller refused refund', ents: [['url', 'cheapgadget-store.example'], ['phone', '9000099904']] },
  { cat: 'upi_payment_fraud', name: 'Tarun Bose', mobile: '9000100034', loss: 12000, days: 6, what: 'UPI PIN shared with a fake customer-care number found online', ents: [['phone', '9000099905'], ['upi_id', 'care.desk@okfictbank']] },
  { cat: 'phishing_or_kyc', name: 'Uma Maheshwari', mobile: '9000100035', loss: 19500, days: 19, what: 'electricity bill disconnection SMS with a payment link', ents: [['url', 'powerbill-pay-now.example'], ['phone', '9000099906']] },
  { cat: 'romance_scam', name: 'Chris Fernandes', mobile: '9000100036', loss: 45000, days: 28, what: 'a long chat friendship; asked for gift card purchases', ents: [['social_handle', '@lena.k.travels'], ['email', 'lena.k@mailbox-help.example']] },
  { cat: 'loan_app_harassment', name: 'Mini Thomas', mobile: '9000100037', loss: 4000, days: 22, what: 'a loan app that accessed the contact list and sent shaming messages', ents: [['app_name', 'EasyRupee Plus'], ['phone', '9000099907']] },
  { cat: 'impersonation', name: 'Salim Akhtar', mobile: '9000100038', loss: 18000, days: 17, what: 'a caller pretending to be a relative stuck at an airport', ents: [['phone', '9000099908'], ['upi_id', 'airport.help@okfictpay']] },
  { cat: 'investment_scam', name: 'Rekha Nambiar', mobile: '9000100039', loss: 33000, days: 13, what: 'a crypto doubling offer on a messaging group', ents: [['url', 'coindouble-fast.example'], ['phone', '9000099909']] },
  { cat: 'job_or_task_scam', name: 'Prakash Jain', mobile: '9000100040', loss: 22000, days: 7, what: 'a hotel review task job; "mentor" asked for deposits to unlock rewards', ents: [['phone', '9000099910'], ['upi_id', 'hotelreview.pay@okfictbank'], ['app_name', 'Telegram']] },
];

const hex = (n: number, width: number) => n.toString(16).padStart(width, '0');
const uid = (prefix: string, n: number) => `${prefix}0000000-0000-4000-8000-${hex(n, 12)}`;
export const seedIds = (i: number) => ({ user: uid('6', i + 1), case: uid('7', i + 1), analysis: uid('9', i + 1) });
export const SEED_ENTITY_CLAIM_TYPES = ['phone', 'upi_id', 'bank_account', 'url', 'email', 'person_name', 'app_name', 'ifsc', 'social_handle'];

const CONTACT_WORDS: Record<Cat, string> = {
  upi_payment_fraud: 'payment request', investment_scam: 'investment offer', job_or_task_scam: 'job offer', loan_app_harassment: 'loan app',
  phishing_or_kyc: 'call and link', sextortion_blackmail: 'video call', romance_scam: 'online friendship', account_hacking: 'account takeover',
  online_shopping: 'online order', impersonation: 'phone call', other: 'incident',
};

/** Fictional, insert-only. Safe to run repeatedly. */
export async function seedV2Complaints(db: Database) {
  const org = loadFixtures().organization.id!;
  const now = new Date('2026-10-28T10:00:00Z').getTime();
  await db.transaction(async (tx) => {
    for (const [i, s] of SEED_SPECS.entries()) {
      const id = seedIds(i);
      const when = new Date(now - s.days * 86_400_000);
      const submitted = new Date(when.getTime() + 3 * 3_600_000);
      const title = `${s.cat === 'other' ? 'Online harassment' : CONTACT_WORDS[s.cat].replace(/^./, (c) => c.toUpperCase())} complaint`;
      const loss = s.loss > 0 ? ` Total loss reported: Rs ${s.loss.toLocaleString('en-IN')}.` : ' No money was lost.';
      const summary = `${s.name} reports ${s.what}.${loss}`;
      await tx.insert(users).values({ id: id.user, role: 'victim', organizationId: null, demoSubject: `intake:${s.mobile}`, displayName: s.name, synthetic: true, createdAt: when }).onConflictDoNothing({ target: users.id });
      await tx.insert(cases).values({ id: id.case, reference: `CG-2026-9${String(i + 1).padStart(5, '0')}`, ownerId: id.user, organizationId: null, status: 'REVIEW_REQUIRED', category: s.cat, title, synthetic: true, createdAt: when, updatedAt: submitted }).onConflictDoNothing({ target: cases.id });
      await tx.insert(caseAccessGrants).values({ id: uid('8', i + 1), caseId: id.case, organizationId: org, scope: 'INVESTIGATE', grantedBy: id.user, createdAt: submitted }).onConflictDoNothing({ target: caseAccessGrants.id });
      await tx.insert(caseAnalyses).values({ caseId: id.case, state: 'READY', summary, totalLoss: s.loss > 0 ? String(s.loss) : null, missing: [], startedAt: submitted, updatedAt: submitted }).onConflictDoNothing({ target: caseAnalyses.caseId });
      await tx.insert(narratives).values({ id: uid('a', i + 1), caseId: id.case, text: `I was contacted through a ${CONTACT_WORDS[s.cat]}. ${s.what.replace(/^./, (c) => c.toUpperCase())}.${s.loss > 0 ? ` I lost Rs ${s.loss}.` : ''}`, channel: 'typed', createdAt: when }).onConflictDoNothing({ target: narratives.id });
      const contact = uid('b', i + 1), pay = uid('c', i + 1);
      const events = [{ id: contact, eventType: 'contact', at: when, title: 'First contact', detail: `Contacted through ${CONTACT_WORDS[s.cat]}.`, label: when.toISOString().slice(0, 10) }];
      if (s.loss > 0) events.push({ id: pay, eventType: 'payment', at: new Date(when.getTime() + 2 * 3_600_000), title: 'Money sent', detail: `Rs ${s.loss.toLocaleString('en-IN')} was paid.`, label: when.toISOString().slice(0, 10) });
      for (const e of events) {
        await tx.insert(timelineEvents).values({ id: e.id, caseId: id.case, eventType: e.eventType, occurredAt: e.at, precision: 'EXACT', uncertainty: 'Fictional seed data.', title: e.title, detail: e.detail, atLabel: e.label, origin: 'AI', sources: [{ type: 'STORY', label: 'What you told us' }], createdAt: when }).onConflictDoNothing({ target: timelineEvents.id });
      }
      const rows = [
        ...(s.loss > 0 ? [{ type: 'payment_amount', rawValue: String(s.loss), meta: null }] : []),
        ...(s.loss > 0 ? [{ type: 'fact', rawValue: `Rs ${s.loss.toLocaleString('en-IN')}`, meta: { origin: 'AI', label: 'Amount lost', group: 'money' } }] : []),
        { type: 'fact', rawValue: CONTACT_WORDS[s.cat], meta: { origin: 'AI', label: 'How it started', group: 'channels' } },
        ...s.ents.map(([type, rawValue]) => ({ type, rawValue, meta: { origin: 'AI' } })),
      ];
      for (const [j, c] of rows.entries()) {
        const claimId = `d${hex(i + 1, 3)}0000-0000-4000-8000-${hex(j + 1, 12)}`;
        await tx.insert(claims).values({ id: claimId, caseId: id.case, type: c.type, rawValue: c.rawValue, normalizedValue: c.meta, sourceKind: 'VICTIM_RECOLLECTION', verificationStatus: 'UNVERIFIED', createdAt: when }).onConflictDoNothing({ target: claims.id });
        if (c.type === 'payment_amount') await tx.insert(eventClaims).values({ caseId: id.case, eventId: pay, claimId }).onConflictDoNothing();
      }
    }
  });
}
