-- Seed data for homestays (host_id = 1, trail_id = 1)
-- Run this script against your offtrail_nepal database

-- Insert sample homestays for host_id 1 along trail_id 1
INSERT INTO homestays (host_id, trail_id, name, location, price_per_night, capacity, description, verified_status, latitude, longitude, is_active, contact_phone)
VALUES
  (1, 1, 'Mountain View Homestay', 'Ghandruk Village, Kaski', 1500.00, 6, 
   'A cozy homestay nestled in the heart of Ghandruk village with stunning views of Annapurna South and Machapuchare. Traditional Gurung hospitality with home-cooked organic meals. Perfect base for day hikes and cultural exploration.', 
   'pending', 28.37190000, 83.80210000, true, '+977-9841234567'),

  (1, 1, 'Sunrise Lodge & Homestay', 'Chhomrong, Kaski', 2000.00, 8,
   'Located at the gateway to Annapurna Base Camp, Sunrise Lodge offers warm hospitality, hot showers, and panoramic mountain views. Wake up to spectacular sunrises over the Himalayan range. Includes breakfast and dinner.',
   'pending', 28.38530000, 83.82450000, true, '+977-9841234568'),

  (1, 1, 'Himalayan Rest House', 'Landruk, Kaski', 1200.00, 4,
   'A peaceful retreat in the scenic village of Landruk. This family-run homestay offers authentic Nepali cuisine, comfortable rooms, and a terrace with breathtaking views of the Modi Khola valley.',
   'pending', 28.35670000, 83.81340000, true, '+977-9841234569');

-- Verify the inserts
SELECT h.homestay_id, h.name, h.location, h.price_per_night, h.capacity, h.verified_status, t.trail_name
FROM homestays h
JOIN trekking_trails t ON h.trail_id = t.trail_id
WHERE h.host_id = 1;
