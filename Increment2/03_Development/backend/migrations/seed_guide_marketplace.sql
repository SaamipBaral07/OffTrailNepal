-- ============================================================
-- SEED DATA: Guide Marketplace Tables
-- Guides: 1=Ram Kafle, 2=Ram Jhakri
-- Trails: 1=Kori Himal, 2=Kothe-Thangnak, 3=Tsum Valley,
--         4=Banthati Mohare, 5=Nar Phu Valley, 6=Upper Dolpo
-- Tourists: 1,2,3,4,6,7
-- ============================================================


-- ============================================================
-- GUIDE TRAILS
-- Ram Kafle → trails 1, 3, 5
-- Ram Jhakri → trails 2, 4, 6
-- ============================================================

INSERT INTO guide_trails (guide_id, trail_id, price_per_day, experience_level, is_active) VALUES
  (1, 1, 2500, 'intermediate', true),  -- Ram Kafle on Kori Himal Trek
  (1, 3, 4500, 'expert',       true),  -- Ram Kafle on Tsum Valley Trek
  (1, 5, 5500, 'expert',       true),  -- Ram Kafle on Nar Phu Valley Trek
  (2, 2, 1800, 'beginner',     true),  -- Ram Jhakri on Kothe-Thangnak Trail
  (2, 4, 2200, 'intermediate', true),  -- Ram Jhakri on Banthati Mohare Trail
  (2, 6, 6000, 'expert',       true);  -- Ram Jhakri on Upper Dolpo Trek


-- ============================================================
-- GUIDE SERVICES
-- Only for trails already in guide_trails above
-- ============================================================

-- Ram Kafle — Kori Himal Trek (trail_id = 1)
INSERT INTO guide_services (guide_id, trail_id, title, price_per_day, max_group_size, description, is_active) VALUES
  (1, 1, 'Budget Trek Guide',
   2000, 4,
   'Affordable guiding service along the Kori Himal route. Includes navigation support, local knowledge, and basic safety briefing for small groups exploring off-beaten paths.',
   true),

  (1, 1, 'Full Support Trek Package',
   3200, 6,
   'Full-service guiding for the Kori Himal Trek. I handle everything from acclimatization planning to daily itinerary. Includes translation, teahouse booking assistance, and cultural insights.',
   true),

  (1, 1, 'Photography Trek Guide',
   3800, 3,
   'Designed for photographers who want to capture the raw beauty of the Kori Himal. I know all the golden-hour viewpoints, hidden meadows, and uncommon angles that most trekkers miss.',
   true);

-- Ram Kafle — Tsum Valley Trek (trail_id = 3)
INSERT INTO guide_services (guide_id, trail_id, title, price_per_day, max_group_size, description, is_active) VALUES
  (1, 3, 'Tsum Valley Cultural Trek',
   4000, 5,
   'A deep cultural immersion into the Tsum Valley — a sacred Himalayan pilgrimage route. I will guide you through local monasteries, villages, and explain Tibetan Buddhist traditions along the way.',
   true),

  (1, 3, 'Premium Expert Guide Package',
   5500, 4,
   'Elite guiding for experienced trekkers on the Tsum Valley route. My 8 years of experience on this trail means I know every shortcut, teahouse, and seasonal risk. Ideal for serious adventurers.',
   true);

-- Ram Kafle — Nar Phu Valley Trek (trail_id = 5)
INSERT INTO guide_services (guide_id, trail_id, title, price_per_day, max_group_size, description, is_active) VALUES
  (1, 5, 'Nar Phu High Altitude Guide',
   5000, 4,
   'Expert guiding across the restricted Nar Phu Valley at altitude over 4,000m. I carry emergency oxygen, know every tea house, and have extensive experience handling altitude sickness protocols.',
   true),

  (1, 5, 'Solo Traveler Specialist',
   5800, 1,
   'Dedicated one-on-one guiding for solo trekkers on the Nar Phu Valley. Personalized pacing, safety monitoring, and complete flexibility to adjust the route based on your comfort and energy.',
   true);

-- Ram Jhakri — Kothe–Thangnak Trail (trail_id = 2)
INSERT INTO guide_services (guide_id, trail_id, title, price_per_day, max_group_size, description, is_active) VALUES
  (2, 2, 'Beginner Friendly Trek',
   1600, 8,
   'Perfect for first-time trekkers. I keep a comfortable pace, explain Himalayan terrain basics, and ensure you enjoy the waterfalls and rhododendron forests of the Kothe–Thangnak trail safely.',
   true),

  (2, 2, 'Family Trek Package',
   2000, 8,
   'Tailored for families with children. The Kothe–Thangnak trail is ideal for families — moderate terrain, stunning views, and I adjust the route for younger or less experienced walkers.',
   true),

  (2, 2, 'Flora & Fauna Nature Guide',
   2400, 5,
   'A nature-focused guided trek highlighting the rich biodiversity of the Tamur River corridor. I identify medicinal plants, mountain birds, and rare Himalayan wildlife along the route.',
   true);

-- Ram Jhakri — Banthati Mohare Trail (trail_id = 4)
INSERT INTO guide_services (guide_id, trail_id, title, price_per_day, max_group_size, description, is_active) VALUES
  (2, 4, 'Panorama Ridge Day Guide',
   2000, 6,
   'The Banthati Mohare trail offers one of the finest unobstructed Himalayan panoramas. I guide you to the best vantage points for sunrise views of Annapurna, Dhaulagiri, and Manaslu.',
   true),

  (2, 4, 'Village Homestay Trek',
   2500, 5,
   'A slow-paced village-to-village trek with overnight homestay experiences. I coordinate local Gurung and Magar homes so you eat and sleep as locals do — an authentic off-the-beaten-path experience.',
   true);

-- Ram Jhakri — Upper Dolpo Trek (trail_id = 6)
INSERT INTO guide_services (guide_id, trail_id, title, price_per_day, max_group_size, description, is_active) VALUES
  (2, 6, 'Upper Dolpo Expedition Guide',
   5500, 4,
   'One of Nepal''s most remote and restricted treks. I manage all permit logistics, lead through the Kang La pass at 5,360m, and ensure your safety in the high trans-Himalayan desert of Dolpo.',
   true),

  (2, 6, 'Shey Phoksundo Lake Package',
   6500, 3,
   'A premium circuit focusing on the turquoise Shey Phoksundo Lake. Includes daily briefings, wildlife spotting (snow leopard territory), and a visit to one of Nepal''s oldest Bon monasteries.',
   true);


-- ============================================================
-- GUIDE AVAILABILITY (next 14 days from 2026-03-21)
-- ============================================================

-- Ram Kafle (guide_id = 1)
INSERT INTO guide_availability (guide_id, available_date, is_available) VALUES
  (1, '2026-03-22', true),
  (1, '2026-03-23', true),
  (1, '2026-03-24', false),  -- busy (private booking)
  (1, '2026-03-25', false),
  (1, '2026-03-26', true),
  (1, '2026-03-27', true),
  (1, '2026-03-28', true),
  (1, '2026-03-29', false),  -- rest day
  (1, '2026-03-30', true),
  (1, '2026-03-31', true),
  (1, '2026-04-01', true),
  (1, '2026-04-02', false),
  (1, '2026-04-03', true),
  (1, '2026-04-04', true);

-- Ram Jhakri (guide_id = 2)
INSERT INTO guide_availability (guide_id, available_date, is_available) VALUES
  (2, '2026-03-22', false),  -- already on trek
  (2, '2026-03-23', false),
  (2, '2026-03-24', true),
  (2, '2026-03-25', true),
  (2, '2026-03-26', true),
  (2, '2026-03-27', false),  -- rest day
  (2, '2026-03-28', true),
  (2, '2026-03-29', true),
  (2, '2026-03-30', false),  -- private group
  (2, '2026-03-31', false),
  (2, '2026-04-01', true),
  (2, '2026-04-02', true),
  (2, '2026-04-03', true),
  (2, '2026-04-04', false);


-- ============================================================
-- GUIDE REVIEWS
-- Tourists: 1=Samip Baral, 2=Ava Subedi, 3=Test User,
--           4=Test User, 6=Proforma Samip, 7=Sam Altman
-- ============================================================

-- Reviews for Ram Kafle (guide_id = 1)
INSERT INTO guide_reviews (guide_id, user_id, rating, comment) VALUES
  (1, 2, 5, 'Ram Kafle is an exceptional guide. His knowledge of the Nar Phu Valley was extraordinary — he knew every turn, every teahouse, and everything about the local culture. Highly recommend!'),
  (1, 3, 5, 'Excellent guide! Very patient with our group and made sure everyone acclimatized properly before pushing to higher altitudes. We felt completely safe throughout the Tsum Valley trek.'),
  (1, 6, 4, 'Great experience overall. Ram is very experienced and helped us cross the high passes without any issues. Would have given 5 stars but we had a small delay at the permit checkpoint.'),
  (1, 7, 5, 'Incredible knowledge of local flora, fauna, and Tibetan Buddhist culture. Ram made the Tsum Valley feel like a living classroom. Already planning to book him again for Upper Dolpo.'),
  (1, 1, 4, 'Very reliable and professional. Ram Kafle has an amazing ability to read the weather and adjust the itinerary to avoid risks. Our group of 4 had a fantastic time on Kori Himal.');

-- Reviews for Ram Jhakri (guide_id = 2)
INSERT INTO guide_reviews (guide_id, user_id, rating, comment) VALUES
  (2, 1, 5, 'Ram Jhakri guided our family on the Banthati Mohare Trail. He was incredibly patient with our kids and made the trek a joyful experience. The sunrise panorama he took us to was breathtaking!'),
  (2, 4, 5, 'Best trekking guide I have ever had. Ram knows the Upper Dolpo like the back of his hand. He navigated the Kang La pass flawlessly and ensured we all reached the top safely.'),
  (2, 6, 4, 'Very knowledgeable about local wildlife and plants along the Kothe-Thangnak trail. The nature interpretation was a bonus I did not expect — gave our trek a completely different dimension.'),
  (2, 2, 5, 'Ram Jhakri was our guide for the Shey Phoksundo Lake circuit. The Bon monastery visit and the lake itself were absolutely magical — Ram added so much context to everything we saw.'),
  (2, 3, 3, 'Good guide overall, friendly and informative. We had some miscommunication about the daily pace but Ram quickly adjusted. The Dolpo region is stunning and he knows it well.');
