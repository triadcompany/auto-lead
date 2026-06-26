-- Add distribution_mode to whatsapp_routing_settings
-- Values: 'settings' (default, uses round-robin/fixed config) | 'automation' (bypass, let automations handle)
ALTER TABLE whatsapp_routing_settings
  ADD COLUMN IF NOT EXISTS distribution_mode TEXT NOT NULL DEFAULT 'settings';
