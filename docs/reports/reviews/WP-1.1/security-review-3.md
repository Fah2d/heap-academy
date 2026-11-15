# security-reviewer, pass 3 (WP-1.1)

Range: `127f523..78cf7ad`. Result: **CHANGES REQUIRED**. No BLOCKER, 1 new MAJOR, 7 MINOR.

All four MAJOR and nine MINOR findings from pass 2 are fixed.

## MAJOR

1. The heartbeat ping URL works like a password. In a public repository, a URL written in a file or a log lets an outsider send the success signal every night, which hides a backup that stopped. **Fixed** in 93afbb6: the URL is a masked secret of `production-backup`, pinged only after the upload and the attestation succeed. WP-7.3's done-when line requires a ping from a scheduled run and one alert after a deliberate silence.

## MINOR, all fixed in 93afbb6

1. T-24 still described the old fingerprint check. Now the committed key is compared with the environment's copy.
2. E-25 still said "freshness check". Now it says heartbeat.
3. The drill wording said "plaintext destroyed". Now the database volume is destroyed.
4. `infra:verify` now checks `staging` too.
5. The deletion email: the user ID is kept 8 days and is listed in the data inventory and in T-17. Deletion never waits on the email, and a failed send is logged by request ID. The server-only secret is named `RESEND_API_KEY`.
6. `backup_reader` has nothing in `vault` and `EXECUTE` revoked on functions in `public` and `private`, and the database test pins both.
7. `gh attestation verify --repo`, and `psql -v ON_ERROR_STOP=1 --single-transaction`.
