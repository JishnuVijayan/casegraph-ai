import { Database } from './connection';
import { loadFixtures } from './fixtures';
import { caseAccessGrants, caseAnalyses, cases, claims, eventClaims, narratives, timelineEvents, users } from './schema';

/**
 * ~40 FICTIONAL submitted complaints for the officer inbox and the case network.
 * Names, numbers, UPI IDs and sites are invented (reserved ".example" domains, fictional handles).
 * Clusters share entities on purpose; some overlaps are weak/benign; some complaints stand alone.
 */
type Cat = 'upi_payment_fraud' | 'investment_scam' | 'job_or_task_scam' | 'loan_app_harassment' | 'phishing_or_kyc' | 'sextortion_blackmail' | 'romance_scam' | 'account_hacking' | 'online_shopping' | 'impersonation' | 'online_harassment' | 'identity_theft' | 'malware_or_ransomware' | 'fake_profile' | 'other';
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

  // ---- Round 2: every crime type, plus links that cross crime types and chains of links (fictional) ----
  // Mule account: ONE bank account receives money in an investment case, a job scam and a romance scam (see Cluster B).
  { cat: 'job_or_task_scam', name: 'Divya Menon', mobile: '9000100041', loss: 64000, days: 18, what: 'a "prepaid task" job; the final deposit went to a bank account that investors also used', ents: [['bank_account', '501000001234 56'], ['phone', '9000120011'], ['app_name', 'Telegram']] },
  { cat: 'romance_scam', name: 'Ajay Kurian', mobile: '9000100042', loss: 140000, days: 12, what: 'a woman he met online asked him to "invest together" and sent a trading link and an account number', ents: [['bank_account', '50100000123456'], ['url', 'tradepro-global.example'], ['social_handle', '@daniel_hart_official']] },
  { cat: 'investment_scam', name: 'Saira Banu', mobile: '9000100043', loss: 275000, days: 5, what: 'a "fund manager" from a dating app profile pushed her into the same trading website', ents: [['url', 'https://tradepro-global.example/vip'], ['social_handle', 'daniel_hart_official'], ['phone', '90000 22222']] },
  // Same operator, two crime types: the sextortion number also collects for a loan app.
  { cat: 'loan_app_harassment', name: 'Naveen Reddy', mobile: '9000100044', loss: 9000, days: 8, what: 'a loan app collector who also threatened to send private pictures to relatives', ents: [['phone', '+91 90000 88888'], ['app_name', 'QuickCash Lite']] },
  { cat: 'sextortion_blackmail', name: 'Karthik Rao', mobile: '9000100045', loss: 52000, days: 3, what: 'a video call turned into blackmail; payments were asked on a UPI ID', ents: [['phone', '9000088888'], ['upi_id', 'safe.deal@okfictpay'], ['social_handle', '@priya.chat.live']] },
  // A chain: P1 and P4 share nothing directly, but P1-P2 share a website, P2-P3 an email and P3-P4 a UPI ID.
  { cat: 'phishing_or_kyc', name: 'Leela Krishnan', mobile: '9000100046', loss: 18000, days: 20, what: 'an SMS about a pending tax refund with a claim link', ents: [['url', 'https://kyc-refund-portal.example/claim'], ['phone', '9000120001']] },
  { cat: 'phishing_or_kyc', name: 'Vinod Pillai', mobile: '9000100047', loss: 36000, days: 14, what: 'a refund portal that asked for card details and an OTP', ents: [['url', 'kyc-refund-portal.example'], ['email', 'refunds@fastclaim.example']] },
  { cat: 'impersonation', name: 'Teresa Dias', mobile: '9000100048', loss: 72000, days: 9, what: 'an "income tax officer" emailed a notice and asked to pay a settlement', ents: [['email', 'Refunds@FastClaim.example'], ['upi_id', 'refund.claims@okfictbank']] },
  { cat: 'upi_payment_fraud', name: 'Harish Nambiar', mobile: '9000100049', loss: 11000, days: 4, what: 'a "refund" collect request approved by mistake; money went to the same UPI ID', ents: [['upi_id', 'Refund.Claims@okfictbank'], ['phone', '9000120009']] },
  // Online harassment (new type): one handle and phone across three people
  { cat: 'online_harassment', name: 'Ishita Roy', mobile: '9000100050', loss: 0, days: 22, what: 'a stranger sent abusive and threatening messages and made new accounts after being blocked', ents: [['social_handle', '@shadow_critic_01'], ['app_name', 'Instagram']] },
  { cat: 'online_harassment', name: 'Farhan Qureshi', mobile: '9000100051', loss: 0, days: 15, what: 'repeated insulting comments and threats to expose personal details', ents: [['social_handle', 'https://instagram.com/shadow_critic_01'], ['phone', '9000130001']] },
  { cat: 'online_harassment', name: 'Gayathri Nair', mobile: '9000100052', loss: 0, days: 6, what: 'someone followed her across platforms and posted her college name', ents: [['phone', '+91 90001 30001'], ['app_name', 'Snapchat']] },
  { cat: 'online_harassment', name: 'Pooja Verma', mobile: '9000100053', loss: 0, days: 2, what: 'a group chat that shared her photos with insulting captions', ents: [['app_name', 'Telegram'], ['social_handle', '@campus_gossip_hub']] },
  // Identity theft / data misuse (new type)
  { cat: 'identity_theft', name: 'Rajeev Menon', mobile: '9000100054', loss: 85000, days: 26, what: 'a personal loan was taken in his name using a copy of his Aadhaar and PAN', ents: [['email', 'loan.verify@docdesk.example'], ['phone', '9000140001']] },
  { cat: 'identity_theft', name: 'Alka Sharma', mobile: '9000100055', loss: 0, days: 17, what: 'her SIM stopped working; a duplicate SIM was issued to someone else', ents: [['phone', '9000140001'], ['person_name', 'Rakesh Dubey']] },
  { cat: 'identity_theft', name: 'Joseph Antony', mobile: '9000100056', loss: 23000, days: 8, what: 'bank accounts opened with his documents; he only found out from SMS alerts', ents: [['email', 'LOAN.VERIFY@docdesk.example'], ['bank_account', '30200000778899']] },
  { cat: 'identity_theft', name: 'Neha Kapoor', mobile: '9000100057', loss: 0, days: 3, what: 'her photo and number were used on a loan application she never made', ents: [['bank_account', '30200000778899'], ['app_name', 'EasyRupee Plus']] },
  // Malware / ransomware / remote access (new type)
  { cat: 'malware_or_ransomware', name: 'Suresh Iyer', mobile: '9000100058', loss: 40000, days: 19, what: 'a shop computer was locked after a file from an email; a payment was demanded to unlock it', ents: [['email', 'unlock.files@securemail.example'], ['url', 'invoice-viewer-download.example']] },
  { cat: 'malware_or_ransomware', name: 'Bhavna Shah', mobile: '9000100059', loss: 0, days: 11, what: 'photos and documents were encrypted after installing a "PDF viewer"', ents: [['url', 'https://invoice-viewer-download.example/setup'], ['email', 'Unlock.Files@securemail.example']] },
  { cat: 'malware_or_ransomware', name: 'Dinesh Pai', mobile: '9000100060', loss: 55000, days: 5, what: 'a "bank support" caller made him install a remote-control app and then moved money', ents: [['app_name', 'AnyDesk'], ['phone', '9000055555']] },
  { cat: 'malware_or_ransomware', name: 'Revathi S', mobile: '9000100061', loss: 0, days: 1, what: 'a fake game app on a third-party store stole saved passwords', ents: [['url', 'freegames-apk-store.example'], ['app_name', 'ModGame Pro']] },
  // Fake profile / false posts (new type), linked to the shopping page and the romance profile
  { cat: 'fake_profile', name: 'Anjali Das', mobile: '9000100062', loss: 0, days: 13, what: 'a fake profile in her name and photos messaged her contacts for money', ents: [['social_handle', '@anjali.das.official2'], ['phone', '9000150001']] },
  { cat: 'fake_profile', name: 'Mukesh Goyal', mobile: '9000100063', loss: 5000, days: 9, what: 'a fake business page copied his shop name and took advance payments', ents: [['social_handle', '@dealsbazaar_x'], ['phone', '9000033333']] },
  { cat: 'fake_profile', name: 'Fatima Noor', mobile: '9000100064', loss: 0, days: 4, what: 'a profile posting false and morphed content about her', ents: [['phone', '9000150001'], ['social_handle', 'https://instagram.com/noor.truth.posts']] },
  { cat: 'fake_profile', name: 'Xavier Pinto', mobile: '9000100065', loss: 12000, days: 2, what: 'a copycat of an NGO page collected "donations" to a personal UPI ID', ents: [['social_handle', '@helping.hands.fund'], ['upi_id', 'donate.now@okfictpay']] },
  // Account hacking cluster (shared phishing page) and more of the existing types
  { cat: 'account_hacking', name: 'Lalitha Subramanian', mobile: '9000100066', loss: 0, days: 21, what: 'a "security check" page captured her social media login', ents: [['url', 'https://fb-security-check.example/login'], ['email', 'recover.support@mailbox-help.example']] },
  { cat: 'account_hacking', name: 'Nikhil Joshi', mobile: '9000100067', loss: 7500, days: 10, what: 'his wallet account was emptied after the same fake security page', ents: [['url', 'fb-security-check.example'], ['phone', '9000160001']] },
  { cat: 'impersonation', name: 'Omana Thomas', mobile: '9000100068', loss: 195000, days: 7, what: 'a fake "cyber cell" officer on video call demanded money for a "case closure"', ents: [['phone', '+91 90000 66666'], ['upi_id', 'settlement.desk@okfictbank'], ['person_name', 'Inspector Rathore']] },
  { cat: 'impersonation', name: 'Yusuf Mirza', mobile: '9000100069', loss: 88000, days: 5, what: 'a caller claimed a parcel in his name had drugs and asked for a "bond" payment', ents: [['phone', '9000066666'], ['person_name', 'Inspector Rathore']] },
  { cat: 'upi_payment_fraud', name: 'Sobha Raj', mobile: '9000100070', loss: 6400, days: 3, what: 'a seller on a marketplace sent a QR code to "receive" money', ents: [['upi_id', 'qrpay.helper@okfictbank'], ['phone', '9000099902']] },
  { cat: 'investment_scam', name: 'Jacob Kurian', mobile: '9000100071', loss: 90000, days: 16, what: 'a crypto doubling group; the admin asked for deposits to a wallet-linked UPI ID', ents: [['url', 'coindouble-fast.example'], ['upi_id', 'coin.doubler@okfictpay']] },
  { cat: 'online_shopping', name: 'Maya Varghese', mobile: '9000100072', loss: 4200, days: 1, what: 'a branded watch from a cheap store never arrived and the store vanished', ents: [['url', 'cheapgadget-store.example'], ['upi_id', 'cheapgadget.pay@okfictbank']] },
];

const hex = (n: number, width: number) => n.toString(16).padStart(width, '0');
const uid = (prefix: string, n: number) => `${prefix}0000000-0000-4000-8000-${hex(n, 12)}`;
export const seedIds = (i: number) => ({ user: uid('6', i + 1), case: uid('7', i + 1), analysis: uid('9', i + 1) });
export const SEED_ENTITY_CLAIM_TYPES = ['phone', 'upi_id', 'bank_account', 'url', 'email', 'person_name', 'app_name', 'ifsc', 'social_handle'];

const CONTACT_WORDS: Record<Cat, string> = {
  upi_payment_fraud: 'payment request', investment_scam: 'investment offer', job_or_task_scam: 'job offer', loan_app_harassment: 'loan app',
  phishing_or_kyc: 'call and link', sextortion_blackmail: 'video call', romance_scam: 'online friendship', account_hacking: 'account takeover',
  online_shopping: 'online order', impersonation: 'phone call', online_harassment: 'abusive messages', identity_theft: 'misuse of my documents',
  malware_or_ransomware: 'harmful file', fake_profile: 'fake profile', other: 'incident',
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
