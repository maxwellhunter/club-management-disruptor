-- Add dining hero image to clubs table
ALTER TABLE clubs ADD COLUMN IF NOT EXISTS dining_image_url text;
