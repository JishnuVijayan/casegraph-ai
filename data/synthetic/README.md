# Synthetic bootstrap data — T02

`bootstrap.json` contains fictional records only: one consortium, two victims,
one analyst, 20 empty case placeholders, and three explicit share grants.
Identifiers are deterministic UUIDs; demo subjects are aliases, not passwords or
working login credentials. Authentication is T03.

Every case title starts with `Synthetic`, and core records carry `synthetic=true`.
`scenarioNote` describes future fixture work; it is not evidence and is not stored
as a claim. Kochi/Bengaluru placeholders do not demonstrate a graph connection.
No screenshots, ledger transactions, OCR outputs or live graph paths are seeded.

One grant is active, one revoked, one expired; 17 cases have no grant. Victims
have no organization membership. Organization association alone must never grant
analysts access: server-side checks are implemented and tested in T03.

Run `npm run db:migrate` then `npm run seed:synthetic` from the repository root
with local infrastructure running. Seeding is transactional and insert-only on
fixture IDs: repeat runs preserve corrections, state changes and revoked grants.
It does not clear other rows. It fails rather than silently adopting a colliding
non-synthetic core identity. There is no automatic reset or destructive reseed.

Future evidence must also be fictional. Never put uploaded originals in the
frontend public directory or commit private data/credentials.
