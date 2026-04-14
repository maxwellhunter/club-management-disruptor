-- Add bookings hero image URL to clubs table
ALTER TABLE clubs ADD COLUMN IF NOT EXISTS bookings_image_url text;
