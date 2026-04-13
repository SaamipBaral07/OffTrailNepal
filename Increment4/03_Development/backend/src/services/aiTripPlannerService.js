import pool from "../config/db.js";

const DEFAULT_MISC_DAILY_BUDGET_NPR = 2000;
const MAX_TRAIL_CANDIDATES = 5;
const MAX_QUERY_TRAILS = 20;
const MAX_TRAIL_ITINERARY_DAYS = 30;

const safeNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const normalizeStringList = (value) => {
  if (Array.isArray(value)) {
    return value
      .map((item) => String(item || "").trim().toLowerCase())
      .filter(Boolean);
  }

  if (typeof value === "string") {
    return value
      .split(/,|\n/)
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean);
  }

  return [];
};

const normalizeDate = (value) => {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
};

const calculateTripDays = (startDate, endDate, fallback = 4) => {
  if (!startDate || !endDate) return fallback;
  const start = new Date(`${startDate}T00:00:00.000Z`);
  const end = new Date(`${endDate}T00:00:00.000Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) {
    return fallback;
  }
  const dayDiff = Math.floor((end - start) / (24 * 60 * 60 * 1000)) + 1;
  return clamp(dayDiff, 1, 30);
};

const normalizeBoolean = (value, fallback = false) => {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true") return true;
    if (normalized === "false") return false;
  }
  return fallback;
};

export const normalizeTripPlannerInput = (payload = {}) => {
  const start_date = normalizeDate(payload.start_date);
  const end_date = normalizeDate(payload.end_date);

  const requestedTripDays = Number.parseInt(payload.trip_days, 10);
  const computedDays = Number.isInteger(requestedTripDays) && requestedTripDays > 0
    ? clamp(requestedTripDays, 1, 30)
    : calculateTripDays(start_date, end_date, 4);

  const budgetRaw = safeNumber(payload.budget_npr);
  const budget_npr = budgetRaw !== null && budgetRaw > 0 ? Math.round(budgetRaw) : null;

  const groupSizeRaw = Number.parseInt(payload.group_size, 10);
  const group_size = Number.isInteger(groupSizeRaw) && groupSizeRaw > 0
    ? clamp(groupSizeRaw, 1, 20)
    : 1;

  const fitnessRaw = String(payload.fitness_level || "intermediate").trim().toLowerCase();
  const fitness_level = ["beginner", "intermediate", "advanced"].includes(fitnessRaw)
    ? fitnessRaw
    : "intermediate";

  const maxAltitudeRaw = Number.parseInt(payload.max_altitude, 10);
  const max_altitude = Number.isInteger(maxAltitudeRaw) && maxAltitudeRaw > 0
    ? maxAltitudeRaw
    : null;

  const preferences = {
    start_date,
    end_date,
    trip_days: computedDays,
    budget_npr,
    group_size,
    fitness_level,
    preferred_regions: normalizeStringList(payload.preferred_regions),
    preferred_difficulties: normalizeStringList(payload.preferred_difficulties),
    interests: normalizeStringList(payload.interests),
    needs_guide: normalizeBoolean(payload.needs_guide, true),
    needs_homestay: normalizeBoolean(payload.needs_homestay, true),
    notes: String(payload.notes || "").trim().slice(0, 1200),
    max_altitude,
  };

  return preferences;
};

const fetchTopHomestaysByTrail = async (trailId) => {
  const result = await pool.query(
    `SELECT h.homestay_id,
            h.name,
            h.location,
            h.price_per_night,
            h.capacity,
            h.available_rooms,
            COALESCE(rs.avg_rating, 0) AS avg_rating,
            COALESCE(rs.total_reviews, 0) AS total_reviews,
            i.image_path AS primary_image_path
     FROM homestays h
     LEFT JOIN LATERAL (
       SELECT ROUND(AVG(r.rating)::numeric, 1) AS avg_rating,
              COUNT(*)::int AS total_reviews
       FROM homestay_reviews r
       WHERE r.homestay_id = h.homestay_id
     ) rs ON true
     LEFT JOIN LATERAL (
       SELECT hi.image_path
       FROM homestay_images hi
       WHERE hi.homestay_id = h.homestay_id
       ORDER BY hi.is_primary DESC, hi.uploaded_at ASC
       LIMIT 1
     ) i ON true
     WHERE h.trail_id = $1
       AND h.verified_status = 'approved'
       AND h.is_active = true
     ORDER BY COALESCE(rs.avg_rating, 0) DESC, h.price_per_night ASC
     LIMIT 3`,
    [trailId]
  );

  return result.rows;
};

const fetchTopGuideServicesByTrail = async (trailId) => {
  const result = await pool.query(
    `SELECT gs.service_id,
            gs.title,
            gs.price_per_day,
            gs.max_group_size,
            gs.min_booking_days,
            g.guide_id,
            g.full_name AS guide_name,
            g.experience_years,
            COALESCE(gr.avg_rating, 0) AS avg_rating,
            COALESCE(gr.total_reviews, 0) AS total_reviews
     FROM guide_services gs
     JOIN guides g ON g.guide_id = gs.guide_id
     JOIN guide_verifications gv ON gv.guide_id = g.guide_id
     LEFT JOIN LATERAL (
       SELECT ROUND(AVG(r.rating)::numeric, 1) AS avg_rating,
              COUNT(*)::int AS total_reviews
       FROM guide_reviews r
       WHERE r.guide_id = g.guide_id
     ) gr ON true
     WHERE gs.trail_id = $1
       AND gs.is_active = true
       AND gv.verification_status = 'approved'
     ORDER BY COALESCE(gr.avg_rating, 0) DESC, gs.price_per_day ASC
     LIMIT 3`,
    [trailId]
  );

  return result.rows;
};

const fetchTrailItinerariesByTrail = async (trailId) => {
  const result = await pool.query(
    `SELECT day_number,
            title,
            description,
            altitude,
            distance_km,
            walking_hours
     FROM trail_itineraries
     WHERE trail_id = $1
     ORDER BY day_number ASC
     LIMIT $2`,
    [trailId, MAX_TRAIL_ITINERARY_DAYS]
  );

  return result.rows;
};

const scoreTrailCandidate = (trail, preferences) => {
  const budgetPerDay = preferences.budget_npr ? preferences.budget_npr / preferences.trip_days : null;
  const stayCost = Number(trail.avg_homestay_price_per_night || 0);
  const guideCost = preferences.needs_guide ? Number(trail.avg_guide_price_per_day || 0) : 0;
  const expectedDailyCost = stayCost + guideCost + DEFAULT_MISC_DAILY_BUDGET_NPR;

  let score = 0;

  if (
    preferences.preferred_regions.length > 0
    && preferences.preferred_regions.includes(String(trail.region || "").toLowerCase())
  ) {
    score += 20;
  }

  if (
    preferences.preferred_difficulties.length > 0
    && preferences.preferred_difficulties.includes(String(trail.difficulty_level || "").toLowerCase())
  ) {
    score += 20;
  }

  if (trail.homestay_count > 0) score += 15;
  if (!preferences.needs_guide || trail.guide_service_count > 0) score += 12;

  if (budgetPerDay) {
    const drift = Math.abs(expectedDailyCost - budgetPerDay) / budgetPerDay;
    score += Math.max(0, 30 - Math.round(drift * 30));
  } else {
    score += 10;
  }

  score += Math.min(10, trail.homestay_count * 2);
  score += Math.min(10, trail.guide_service_count * 2);

  if (preferences.max_altitude && trail.max_altitude && trail.max_altitude <= preferences.max_altitude) {
    score += 8;
  }

  return {
    ...trail,
    expected_daily_cost_npr: Math.round(expectedDailyCost),
    recommendation_score: score,
  };
};

export const fetchTripPlannerCandidates = async (preferences) => {
  const fetchTrailRows = async ({
    useRegion = true,
    useDifficulty = true,
    useAltitude = true,
  }) => {
    const whereClauses = [];
    const values = [];

    const regionEnabled = useRegion && preferences.preferred_regions.length > 0;
    const difficultyEnabled = useDifficulty && preferences.preferred_difficulties.length > 0;
    const altitudeEnabled = useAltitude && Boolean(preferences.max_altitude);

    if (regionEnabled) {
      values.push(preferences.preferred_regions);
      const idx = values.length;
      whereClauses.push(`LOWER(t.region) = ANY($${idx}::text[])`);
    }

    if (difficultyEnabled) {
      values.push(preferences.preferred_difficulties);
      const idx = values.length;
      whereClauses.push(`LOWER(t.difficulty_level) = ANY($${idx}::text[])`);
    }

    if (altitudeEnabled) {
      values.push(preferences.max_altitude);
      const idx = values.length;
      whereClauses.push(`(t.max_altitude IS NULL OR t.max_altitude <= $${idx})`);
    }

    const whereSql = whereClauses.length ? `WHERE ${whereClauses.join(" AND ")}` : "";

    const result = await pool.query(
      `SELECT t.trail_id,
              t.trail_name,
              t.region,
              t.difficulty_level,
              t.duration_days,
              t.max_altitude,
              t.description,
              t.created_at,
              ti.image_path AS primary_image_path,
              COALESCE(h.avg_price_per_night, 0)::numeric(12, 2) AS avg_homestay_price_per_night,
              COALESCE(h.homestay_count, 0)::int AS homestay_count,
              COALESCE(g.avg_price_per_day, 0)::numeric(12, 2) AS avg_guide_price_per_day,
              COALESCE(g.service_count, 0)::int AS guide_service_count
       FROM trekking_trails t
       LEFT JOIN LATERAL (
         SELECT image_path
         FROM trail_images
         WHERE trail_id = t.trail_id
         ORDER BY is_primary DESC, uploaded_at ASC
         LIMIT 1
       ) ti ON true
       LEFT JOIN LATERAL (
         SELECT AVG(h2.price_per_night)::numeric(12, 2) AS avg_price_per_night,
                COUNT(*)::int AS homestay_count
         FROM homestays h2
         WHERE h2.trail_id = t.trail_id
           AND h2.verified_status = 'approved'
           AND h2.is_active = true
       ) h ON true
       LEFT JOIN LATERAL (
         SELECT AVG(gs.price_per_day)::numeric(12, 2) AS avg_price_per_day,
                COUNT(*)::int AS service_count
         FROM guide_services gs
         JOIN guide_verifications gv ON gv.guide_id = gs.guide_id
         WHERE gs.trail_id = t.trail_id
           AND gs.is_active = true
           AND gv.verification_status = 'approved'
       ) g ON true
       ${whereSql}
       ORDER BY t.created_at DESC
       LIMIT ${MAX_QUERY_TRAILS}`,
      values
    );

    return {
      rows: result.rows,
      signature: `${regionEnabled ? 1 : 0}-${difficultyEnabled ? 1 : 0}-${altitudeEnabled ? 1 : 0}`,
    };
  };

  const queryStages = [
    {
      match_strategy: "strict",
      relaxed_filters: [],
      useRegion: true,
      useDifficulty: true,
      useAltitude: true,
    },
    {
      match_strategy: "relaxed_difficulty",
      relaxed_filters: ["difficulty"],
      useRegion: true,
      useDifficulty: false,
      useAltitude: true,
    },
    {
      match_strategy: "relaxed_altitude",
      relaxed_filters: ["altitude"],
      useRegion: true,
      useDifficulty: true,
      useAltitude: false,
    },
    {
      match_strategy: "region_only",
      relaxed_filters: ["difficulty", "altitude"],
      useRegion: true,
      useDifficulty: false,
      useAltitude: false,
    },
    {
      match_strategy: "global_fallback",
      relaxed_filters: ["region", "difficulty", "altitude"],
      useRegion: false,
      useDifficulty: false,
      useAltitude: false,
    },
  ];

  let trailsRows = [];
  let matchStrategy = "strict";
  let relaxedFilters = [];
  const seenSignatures = new Set();

  for (const stage of queryStages) {
    const { rows, signature } = await fetchTrailRows(stage);
    if (seenSignatures.has(signature)) {
      continue;
    }
    seenSignatures.add(signature);

    if (rows.length > 0) {
      trailsRows = rows;
      matchStrategy = stage.match_strategy;
      relaxedFilters = stage.relaxed_filters;
      break;
    }
  }

  const scoredTrails = trailsRows
    .map((trail) => scoreTrailCandidate(trail, preferences))
    .sort((a, b) => b.recommendation_score - a.recommendation_score)
    .slice(0, MAX_TRAIL_CANDIDATES);

  const enrichedTrails = [];
  for (const trail of scoredTrails) {
    const recommendedHomestays = await fetchTopHomestaysByTrail(trail.trail_id);
    const recommendedGuideServices = await fetchTopGuideServicesByTrail(trail.trail_id);
    const trailItineraries = await fetchTrailItinerariesByTrail(trail.trail_id);

    enrichedTrails.push({
      ...trail,
      recommended_homestays: recommendedHomestays,
      recommended_guide_services: recommendedGuideServices,
      trail_itineraries: trailItineraries,
    });
  }

  return {
    trails: enrichedTrails,
    match_strategy: trailsRows.length > 0 ? matchStrategy : "no_inventory",
    relaxed_filters: trailsRows.length > 0 ? relaxedFilters : ["region", "difficulty", "altitude"],
  };
};

const getStartDateForPlan = (preferences) => {
  if (preferences.start_date) return preferences.start_date;
  return new Date().toISOString().slice(0, 10);
};

const buildDateForDay = (startDateBase, offset) => {
  const dateForDay = new Date(startDateBase);
  dateForDay.setUTCDate(startDateBase.getUTCDate() + offset);
  return dateForDay.toISOString().slice(0, 10);
};

const normalizeText = (value) => String(value || "").trim();

const toTitleCase = (value) => {
  const text = normalizeText(value);
  if (!text) return "";
  return text.charAt(0).toUpperCase() + text.slice(1);
};

const buildTemplateDayDetails = ({
  dayNumber,
  tripDays,
  primaryTrail,
  selectedHomestay,
  selectedGuide,
}) => {
  if (dayNumber === 1) {
    return {
      title: "Arrival and route briefing",
      activities: [
        `Travel to ${primaryTrail.region} and complete local check-in`,
        `Settle into ${selectedHomestay?.name || "a recommended homestay"}`,
        `Review the ${primaryTrail.trail_name} route plan and safety briefing`,
      ],
    };
  }

  if (dayNumber === tripDays) {
    return {
      title: "Return and wrap-up",
      activities: [
        "Complete a lighter final walking segment",
        "Return to transport point and local market area",
        "Review trip highlights and departure logistics",
      ],
    };
  }

  if (dayNumber === 2) {
    return {
      title: "Acclimatization and first major ascent",
      activities: [
        `Begin early on a controlled ascent section of ${primaryTrail.trail_name}`,
        "Take scheduled hydration and altitude adjustment breaks",
        "End day with gear check for next segment",
      ],
    };
  }

  if (dayNumber === tripDays - 1) {
    return {
      title: "Scenic traverse and gradual descent",
      activities: [
        "Cover a viewpoint-focused section with photo stops",
        "Begin controlled descent to lower altitude",
        "Prepare contingency plan for weather changes",
      ],
    };
  }

  const midPhaseIndex = dayNumber % 3;
  if (midPhaseIndex === 0) {
    return {
      title: `Trail progression day ${dayNumber}`,
      activities: [
        `Move through a core segment of ${primaryTrail.trail_name}`,
        "Coordinate pace around group fitness and trail conditions",
        selectedGuide
          ? `Take local terrain guidance from ${selectedGuide.guide_name}`
          : "Use route markers and weather checks before each segment",
      ],
    };
  }

  if (midPhaseIndex === 1) {
    return {
      title: `Culture and landscape immersion ${dayNumber}`,
      activities: [
        "Blend trekking section with village and tea-stop interactions",
        "Capture major landscape points and monitor weather windows",
        "Reconfirm next-day route timing and checkpoints",
      ],
    };
  }

  return {
    title: `Endurance and pacing day ${dayNumber}`,
    activities: [
      "Cover moderate-to-long walking section with pace control",
      "Maintain hydration, calorie intake, and rest intervals",
      "Review terrain risk points for the following day",
    ],
  };
};

const buildDayFromTrailItinerary = ({
  dayNumber,
  itineraryRow,
  tripDays,
  primaryTrail,
  selectedHomestay,
  selectedGuide,
}) => {
  if (!itineraryRow) {
    return buildTemplateDayDetails({
      dayNumber,
      tripDays,
      primaryTrail,
      selectedHomestay,
      selectedGuide,
    });
  }

  const title = normalizeText(itineraryRow.title) || `Itinerary day ${dayNumber}`;
  const activities = [];

  if (dayNumber === 1) {
    activities.push(`Travel to ${primaryTrail.region} and begin trek setup`);
  }

  const description = normalizeText(itineraryRow.description);
  if (description) {
    activities.push(description);
  }

  if (itineraryRow.distance_km !== null && itineraryRow.distance_km !== undefined) {
    activities.push(`Approx distance: ${Number(itineraryRow.distance_km)} km`);
  }

  if (itineraryRow.walking_hours !== null && itineraryRow.walking_hours !== undefined) {
    activities.push(`Estimated walking hours: ${Number(itineraryRow.walking_hours)}`);
  }

  if (itineraryRow.altitude !== null && itineraryRow.altitude !== undefined) {
    activities.push(`Expected altitude: ${Number(itineraryRow.altitude)} m`);
  }

  if (activities.length === 0) {
    activities.push(`Follow planned segment ${dayNumber} of ${primaryTrail.trail_name}`);
  }

  if (dayNumber === tripDays) {
    activities.push("Wrap up trek segment and prepare return logistics");
  }

  return {
    title: toTitleCase(title),
    activities,
  };
};

const isRedundantDayPlan = (dayPlan = []) => {
  if (!Array.isArray(dayPlan) || dayPlan.length < 3) return false;

  const titleSignatures = dayPlan.map((day) => normalizeText(day?.title).toLowerCase());
  const activitySignatures = dayPlan.map((day) => {
    const activities = Array.isArray(day?.activities) ? day.activities : [];
    return activities.map((item) => normalizeText(item).toLowerCase()).join(" | ");
  });

  const uniqueTitles = new Set(titleSignatures.filter(Boolean));
  const uniqueActivitySets = new Set(activitySignatures.filter(Boolean));

  let adjacentRepeats = 0;
  for (let index = 1; index < activitySignatures.length; index += 1) {
    if (activitySignatures[index] && activitySignatures[index] === activitySignatures[index - 1]) {
      adjacentRepeats += 1;
    }
  }

  const repetitiveFollowPatternCount = activitySignatures.filter((signature) =>
    signature.includes("follow the") && signature.includes("hydration")
  ).length;

  const lowTitleDiversity = uniqueTitles.size <= Math.ceil(dayPlan.length / 2);
  const lowActivityDiversity = uniqueActivitySets.size <= Math.ceil(dayPlan.length / 2);
  const tooManyAdjacentRepeats = adjacentRepeats >= Math.floor(dayPlan.length / 2);
  const repetitivePatternDominates = repetitiveFollowPatternCount >= dayPlan.length - 1;

  return lowTitleDiversity || lowActivityDiversity || tooManyAdjacentRepeats || repetitivePatternDominates;
};

export const buildFallbackTripPlan = ({ preferences, candidates }) => {
  const primaryTrail = candidates.trails[0];
  if (!primaryTrail) {
    return {
      title: "No itinerary available",
      overview: "No trail matched your current filters. Try broadening region or difficulty preferences.",
      assumptions: [],
      recommended_trail: null,
      day_plan: [],
      cost_breakdown: {
        homestay_total_npr: 0,
        guide_total_npr: 0,
        misc_total_npr: 0,
        total_estimated_npr: 0,
        budget_fit: "unknown",
      },
      alternatives: [],
      packing_tips: [],
      cautions: [],
    };
  }

  const tripDays = clamp(primaryTrail.duration_days || preferences.trip_days || 4, 1, 30);
  const selectedHomestay = primaryTrail.recommended_homestays[0] || null;
  const selectedGuide = primaryTrail.recommended_guide_services[0] || null;
  const trailItineraries = Array.isArray(primaryTrail.trail_itineraries)
    ? primaryTrail.trail_itineraries
    : [];

  const dailyHomestay = Number(selectedHomestay?.price_per_night || primaryTrail.avg_homestay_price_per_night || 0);
  const dailyGuide = preferences.needs_guide
    ? Number(selectedGuide?.price_per_day || primaryTrail.avg_guide_price_per_day || 0)
    : 0;
  const dailyMisc = DEFAULT_MISC_DAILY_BUDGET_NPR;

  const homestayTotal = Math.round(dailyHomestay * tripDays);
  const guideTotal = Math.round(dailyGuide * tripDays);
  const miscTotal = Math.round(dailyMisc * tripDays);
  const total = homestayTotal + guideTotal + miscTotal;

  const budgetFit = preferences.budget_npr
    ? (total <= preferences.budget_npr ? "within_budget" : "over_budget")
    : "unknown";

  const startDate = getStartDateForPlan(preferences);
  const startDateBase = new Date(`${startDate}T00:00:00.000Z`);

  const day_plan = Array.from({ length: tripDays }).map((_, index) => {
    const dayNumber = index + 1;
    const itineraryRow = trailItineraries[index] || null;
    const dayDetails = buildDayFromTrailItinerary({
      dayNumber,
      itineraryRow,
      tripDays,
      primaryTrail,
      selectedHomestay,
      selectedGuide,
    });

    return {
      day: dayNumber,
      date: buildDateForDay(startDateBase, index),
      title: dayDetails.title,
      activities: dayDetails.activities,
      stay_recommendation: selectedHomestay
        ? {
            homestay_id: selectedHomestay.homestay_id,
            name: selectedHomestay.name,
            location: selectedHomestay.location,
            price_per_night: Number(selectedHomestay.price_per_night),
          }
        : null,
      guide_recommendation: selectedGuide
        ? {
            service_id: selectedGuide.service_id,
            guide_id: selectedGuide.guide_id,
            guide_name: selectedGuide.guide_name,
            title: selectedGuide.title,
            price_per_day: Number(selectedGuide.price_per_day),
          }
        : null,
      estimated_cost_npr: Math.round(dailyHomestay + dailyGuide + dailyMisc),
      safety_note: "Carry essentials, monitor weather, and follow local guide advice.",
    };
  });

  const alternatives = candidates.trails.slice(1, 3).map((trail) => ({
    trail_id: trail.trail_id,
    trail_name: trail.trail_name,
    region: trail.region,
    difficulty_level: trail.difficulty_level,
    duration_days: trail.duration_days,
    expected_daily_cost_npr: trail.expected_daily_cost_npr,
  }));

  return {
    title: `${primaryTrail.trail_name} ${tripDays}-day plan`,
    overview: `A practical itinerary focused on ${primaryTrail.region} with options aligned to your preferences.`,
    assumptions: [
      `Group size considered: ${preferences.group_size}`,
      `Fitness level considered: ${preferences.fitness_level}`,
      preferences.budget_npr ? `Budget target: NPR ${preferences.budget_npr}` : "No strict budget was provided",
    ],
    recommended_trail: {
      trail_id: primaryTrail.trail_id,
      trail_name: primaryTrail.trail_name,
      region: primaryTrail.region,
      difficulty_level: primaryTrail.difficulty_level,
      duration_days: primaryTrail.duration_days,
      max_altitude: primaryTrail.max_altitude,
      primary_image_path: primaryTrail.primary_image_path,
    },
    day_plan,
    cost_breakdown: {
      homestay_total_npr: homestayTotal,
      guide_total_npr: guideTotal,
      misc_total_npr: miscTotal,
      total_estimated_npr: total,
      budget_fit: budgetFit,
      trip_days_used: tripDays,
      daily_homestay_rate_npr: Math.round(dailyHomestay),
      daily_guide_rate_npr: Math.round(dailyGuide),
      daily_misc_rate_npr: dailyMisc,
      selected_homestay: selectedHomestay
        ? {
            homestay_id: selectedHomestay.homestay_id,
            name: selectedHomestay.name,
            location: selectedHomestay.location,
          }
        : null,
      selected_guide_service: selectedGuide
        ? {
            service_id: selectedGuide.service_id,
            title: selectedGuide.title,
            guide_name: selectedGuide.guide_name,
          }
        : null,
      cost_formula: "(daily_homestay_rate_npr + daily_guide_rate_npr + daily_misc_rate_npr) * trip_days_used",
    },
    alternatives,
    packing_tips: [
      "Layered clothing suitable for sudden weather changes",
      "Water purification and high-energy snacks",
      "Basic first-aid and personal medication",
    ],
    cautions: [
      "Weather and trail conditions can change quickly in mountain regions",
      "Verify guide and accommodation availability before booking",
    ],
  };
};

const normalizeModelJson = (rawContent) => {
  if (!rawContent) return null;

  let content = rawContent;

  if (Array.isArray(rawContent)) {
    content = rawContent
      .map((part) => {
        if (typeof part === "string") return part;
        if (part && typeof part.text === "string") return part.text;
        return "";
      })
      .join("\n");
  }

  if (typeof content !== "string") return null;

  const trimmed = content.trim();
  const withoutFence = trimmed
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();

  try {
    return JSON.parse(withoutFence);
  } catch {
    return null;
  }
};

const detectLLMProvider = (apiUrl) => {
  const configuredProvider = String(process.env.AI_LLM_PROVIDER || "").trim().toLowerCase();
  if (configuredProvider) return configuredProvider;

  try {
    const parsed = new URL(apiUrl);
    const host = String(parsed.hostname || "").toLowerCase();
    const port = String(parsed.port || "");
    if ((host === "localhost" || host === "127.0.0.1") && port === "11434") {
      return "ollama";
    }
  } catch {
    // Ignore parse failures and fall back to default provider.
  }

  return "openai";
};

const buildLLMMessages = ({ preferences, candidates }) => {
  const compactCandidates = candidates.trails.map((trail) => ({
    trail_id: trail.trail_id,
    trail_name: trail.trail_name,
    region: trail.region,
    difficulty_level: trail.difficulty_level,
    duration_days: trail.duration_days,
    max_altitude: trail.max_altitude,
    expected_daily_cost_npr: trail.expected_daily_cost_npr,
    recommended_homestays: trail.recommended_homestays.map((homestay) => ({
      homestay_id: homestay.homestay_id,
      name: homestay.name,
      location: homestay.location,
      price_per_night: Number(homestay.price_per_night || 0),
      avg_rating: Number(homestay.avg_rating || 0),
    })),
    recommended_guide_services: trail.recommended_guide_services.map((service) => ({
      service_id: service.service_id,
      title: service.title,
      guide_id: service.guide_id,
      guide_name: service.guide_name,
      price_per_day: Number(service.price_per_day || 0),
      avg_rating: Number(service.avg_rating || 0),
      min_booking_days: service.min_booking_days,
    })),
    itinerary_days: Array.isArray(trail.trail_itineraries)
      ? trail.trail_itineraries.map((row) => ({
          day_number: row.day_number,
          title: row.title,
          description: row.description,
          altitude: row.altitude,
          distance_km: row.distance_km,
          walking_hours: row.walking_hours,
        }))
      : [],
  }));

  const systemPrompt = [
    "You are an expert Nepal trekking itinerary planner.",
    "Return strict JSON only, no markdown and no extra text.",
    "Use only provided candidates; do not invent trail_id, homestay_id, service_id, or prices.",
    "Prefer practical and safe plans with realistic day pacing.",
    "Each day must be materially different from other days; avoid repeating the same activity bullets across consecutive days.",
    "If itinerary_days is provided for a trail, use it to create specific day-by-day progression instead of generic repetitive text.",
    "Required JSON keys: title, overview, assumptions, recommended_trail, day_plan, cost_breakdown, alternatives, packing_tips, cautions.",
    "day_plan must be an array with one entry per day; each entry includes day, title, activities, stay_recommendation, guide_recommendation, estimated_cost_npr, safety_note.",
    "cost_breakdown must include homestay_total_npr, guide_total_npr, misc_total_npr, total_estimated_npr, budget_fit.",
  ].join(" ");

  const userPrompt = JSON.stringify({ preferences, candidates: compactCandidates });

  return [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ];
};

const attemptLLMTripPlan = async ({ preferences, candidates }) => {
  const model = process.env.AI_TRIP_PLANNER_MODEL || "gpt-4o-mini";
  const apiUrl = process.env.AI_LLM_API_URL || "https://api.openai.com/v1/chat/completions";
  const provider = detectLLMProvider(apiUrl);
  const apiKey = process.env.OPENAI_API_KEY || process.env.AI_API_KEY;
  const isOllama = provider === "ollama";

  if (!isOllama && !apiKey) {
    return null;
  }

  const headers = {
    "Content-Type": "application/json",
  };

  if (!isOllama && apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
  }

  const requestBody = {
    model,
    temperature: isOllama ? 0.75 : 0.4,
    messages: buildLLMMessages({ preferences, candidates }),
  };

  if (!isOllama) {
    requestBody.response_format = { type: "json_object" };
  } else {
    requestBody.stream = false;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);

  try {
    const response = await fetch(apiUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });

    if (!response.ok) {
      const bodyText = await response.text();
      throw new Error(`LLM API error ${response.status}: ${bodyText.slice(0, 400)}`);
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;
    const parsedPlan = normalizeModelJson(content);

    if (!parsedPlan || typeof parsedPlan !== "object") {
      throw new Error("LLM did not return valid JSON itinerary");
    }

    return {
      plan: parsedPlan,
      provider,
      model,
      status: "generated",
    };
  } finally {
    clearTimeout(timeout);
  }
};

const ensurePlanShape = (plan, fallbackPlan) => {
  if (!plan || typeof plan !== "object") return fallbackPlan;

  if (!Array.isArray(plan.day_plan) || plan.day_plan.length === 0) {
    return fallbackPlan;
  }

  const normalized = {
    ...plan,
    assumptions: Array.isArray(plan.assumptions) ? plan.assumptions : fallbackPlan.assumptions,
    alternatives: Array.isArray(plan.alternatives) ? plan.alternatives : fallbackPlan.alternatives,
    packing_tips: Array.isArray(plan.packing_tips) ? plan.packing_tips : fallbackPlan.packing_tips,
    cautions: Array.isArray(plan.cautions) ? plan.cautions : fallbackPlan.cautions,
    recommended_trail: plan.recommended_trail || fallbackPlan.recommended_trail,
    cost_breakdown: {
      ...(fallbackPlan.cost_breakdown || {}),
      ...(plan.cost_breakdown || {}),
    },
  };

  const totalEstimate = safeNumber(normalized?.cost_breakdown?.total_estimated_npr);
  if (totalEstimate === null) {
    normalized.cost_breakdown.total_estimated_npr = fallbackPlan.cost_breakdown.total_estimated_npr;
  }

  if (isRedundantDayPlan(normalized.day_plan)) {
    return fallbackPlan;
  }

  return normalized;
};

export const createTripPlan = async ({ preferences }) => {
  const candidates = await fetchTripPlannerCandidates(preferences);
  if (!candidates.trails.length) {
    const isInventoryEmpty = candidates.match_strategy === "no_inventory";
    const error = new Error(isInventoryEmpty ? "No listing inventory available" : "No matching trail candidates");
    error.code = isInventoryEmpty ? "NO_INVENTORY" : "NO_CANDIDATES";
    throw error;
  }

  const fallbackPlan = buildFallbackTripPlan({ preferences, candidates });

  try {
    const llmResult = await attemptLLMTripPlan({ preferences, candidates });
    if (!llmResult) {
      return {
        plan: fallbackPlan,
        provider: "fallback",
        model: null,
        status: "fallback",
        candidates,
      };
    }

    return {
      plan: ensurePlanShape(llmResult.plan, fallbackPlan),
      provider: llmResult.provider,
      model: llmResult.model,
      status: llmResult.status,
      candidates,
    };
  } catch (error) {
    return {
      plan: fallbackPlan,
      provider: "fallback",
      model: null,
      status: "fallback",
      candidates,
      llm_error: error.message,
    };
  }
};
