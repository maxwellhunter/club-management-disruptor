-- Add events hero image URL to clubs table
ALTER TABLE clubs ADD COLUMN IF NOT EXISTS events_image_url text;
