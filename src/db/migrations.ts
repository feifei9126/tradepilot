// Release manifest. A test compares this with the immutable SQL migrations.
export const DATABASE_MIGRATIONS = [
  {
    "version": "0000_extensions.sql",
    "checksum": "6b9d13405012508438e45a4e665e444a10bd8172f56b825a3e5560f8e3329275"
  },
  {
    "version": "0001_accounts.sql",
    "checksum": "25641d0ad9b382536a12acb8ab5f4d0fc97a62a4c7971ca5a20b34b9c9f6cf2c"
  },
  {
    "version": "0002_tenant_crm.sql",
    "checksum": "dc8aac248f2329e1f8161baf66b69f29196c712e6c912dad4f943f4b06ea7080"
  },
  {
    "version": "0003_saas_storage.sql",
    "checksum": "1238da32dd67b5bc17c2d83e125ad5567e3a222ed7f09c5e9fe5b1df8c6a58d4"
  },
  {
    "version": "0004_account_integrity.sql",
    "checksum": "023e3e53068270f26402ea67831ff3acfaefaf35cd0060b8ee6a9b7263eed0fc"
  },
  {
    "version": "0005_tenant_ai_webhook_rate_limits.sql",
    "checksum": "6a7f69a9467a6d2abea35ac220deb7974a56d8a287da7f7d6493709df0e72eae"
  },
  {
    "version": "0006_billing_email_media.sql",
    "checksum": "6c2ae2a2c09d65945b7d567f0baba70a91470a607a24e774063cfa0c4ef4de38"
  },
  {
    "version": "0007_production_hardening.sql",
    "checksum": "9dabc36e2f545652456531aa33bdde1f209836432aabbec39862207115202765"
  },
  {
    "version": "0008_subscription_unpaid_status.sql",
    "checksum": "e63c356395c95ec509ff6b3d9faabce529ee8de704f485a977ca9b00c97932b3"
  },
  {
    "version": "0009_audit_code_security.sql",
    "checksum": "02c9aedc789b4ef152d489519401e8e8a26b1d060e473773d6442f9f0cb38154"
  },
  {
    "version": "0010_messaging_channels.sql",
    "checksum": "6f5bd64a3be7dbd04b86ff1947518743ae5ef50db08751bdea7a665c6c172566"
}
] as const;
