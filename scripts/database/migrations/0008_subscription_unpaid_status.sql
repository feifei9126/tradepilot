-- Preserve Stripe's `unpaid` subscription state explicitly so billing summaries
-- can fail closed instead of treating it as a payment grace period.
ALTER TABLE subscriptions DROP CONSTRAINT IF EXISTS subscriptions_status_check;
ALTER TABLE subscriptions ADD CONSTRAINT subscriptions_status_check
  CHECK (status IN ('trialing','active','past_due','paused','canceled','incomplete','incomplete_expired','unpaid'));
