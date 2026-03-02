-- Insert default plans
INSERT INTO "Plan" (id, name, "displayName", "priceMonthly", "messageLimit", "isActive")
VALUES 
  ('basic', 'basic', 'Básico', 97.00, 500, true),
  ('pro', 'pro', 'Profissional', 197.00, 2000, true),
  ('enterprise', 'enterprise', 'Enterprise', 397.00, 10000, true)
ON CONFLICT (id) DO UPDATE SET
  "displayName" = EXCLUDED."displayName",
  "priceMonthly" = EXCLUDED."priceMonthly",
  "messageLimit" = EXCLUDED."messageLimit",
  "isActive" = EXCLUDED."isActive";
