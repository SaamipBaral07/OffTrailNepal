import pool from "../config/db.js";
import { createTripPlan, normalizeTripPlannerInput } from "../services/aiTripPlannerService.js";

const ALLOWED_FEEDBACK_TYPES = new Set(["like", "dislike", "edited", "booked"]);

const parsePlanId = (value) => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) return null;
  return parsed;
};

const requireTourist = (req, res) => {
  if (req.user?.user_type !== "tourist") {
    res.status(403).json({ message: "Tourist access only" });
    return false;
  }
  return true;
};

export const generateTripPlan = async (req, res) => {
  if (!requireTourist(req, res)) return;

  try {
    const preferences = normalizeTripPlannerInput(req.body);
    const plannerResult = await createTripPlan({ preferences });

    const totalEstimatedCost = Number(plannerResult?.plan?.cost_breakdown?.total_estimated_npr);
    const totalEstimatedCostSafe = Number.isFinite(totalEstimatedCost) ? totalEstimatedCost : null;

    const insertResult = await pool.query(
      `INSERT INTO ai_trip_plans
         (requester_user_id, requester_user_type, request_payload, candidate_snapshot, generated_plan,
          provider, model, status, total_estimated_cost)
       VALUES ($1, $2, $3::jsonb, $4::jsonb, $5::jsonb, $6, $7, $8, $9)
       RETURNING plan_id, created_at`,
      [
        req.user.user_id,
        req.user.user_type,
        JSON.stringify(preferences),
        JSON.stringify(plannerResult.candidates),
        JSON.stringify(plannerResult.plan),
        plannerResult.provider,
        plannerResult.model,
        plannerResult.status,
        totalEstimatedCostSafe,
      ]
    );

    return res.status(201).json({
      message: "Trip plan generated successfully",
      plan_id: insertResult.rows[0].plan_id,
      created_at: insertResult.rows[0].created_at,
      provider: plannerResult.provider,
      model: plannerResult.model,
      status: plannerResult.status,
      llm_error: plannerResult.llm_error || null,
      match_strategy: plannerResult.candidates?.match_strategy || "strict",
      relaxed_filters: plannerResult.candidates?.relaxed_filters || [],
      plan: plannerResult.plan,
      candidates: plannerResult.candidates?.trails || [],
    });
  } catch (error) {
    if (error?.code === "53300") {
      return res.status(503).json({
        message: "Database is temporarily busy (too many connections). Please try again in a few seconds.",
      });
    }

    if (error.code === "NO_INVENTORY") {
      return res.status(404).json({
        message: "No trails are listed in the system yet. Please ask admin/host/guide to add trail and listing data first.",
      });
    }

    if (error.code === "NO_CANDIDATES") {
      return res.status(404).json({
        message: "No trip candidates matched strict filters. The planner already tried broader fallback filters, but still found no suitable options.",
      });
    }

    console.error("Error generating trip plan:", error);
    return res.status(500).json({ message: "Server error generating trip plan" });
  }
};

export const getMyTripPlans = async (req, res) => {
  if (!requireTourist(req, res)) return;

  try {
    const result = await pool.query(
      `SELECT plan_id,
              provider,
              model,
              status,
              total_estimated_cost,
              generated_plan->>'title' AS plan_title,
              created_at,
              updated_at
       FROM ai_trip_plans
       WHERE requester_user_id = $1
         AND requester_user_type = $2
       ORDER BY created_at DESC
       LIMIT 50`,
      [req.user.user_id, req.user.user_type]
    );

    return res.status(200).json({ plans: result.rows });
  } catch (error) {
    console.error("Error fetching trip plans:", error);
    return res.status(500).json({ message: "Server error fetching trip plans" });
  }
};

export const getMyTripPlanById = async (req, res) => {
  if (!requireTourist(req, res)) return;

  try {
    const planId = parsePlanId(req.params.planId);
    if (!planId) {
      return res.status(400).json({ message: "Invalid plan id" });
    }

    const planResult = await pool.query(
      `SELECT plan_id,
              requester_user_id,
              requester_user_type,
              request_payload,
              candidate_snapshot,
              generated_plan,
              provider,
              model,
              status,
              total_estimated_cost,
              created_at,
              updated_at
       FROM ai_trip_plans
       WHERE plan_id = $1
         AND requester_user_id = $2
         AND requester_user_type = $3`,
      [planId, req.user.user_id, req.user.user_type]
    );

    if (!planResult.rows.length) {
      return res.status(404).json({ message: "Trip plan not found" });
    }

    const feedbackResult = await pool.query(
      `SELECT feedback_id, feedback_type, feedback_notes, edited_plan, created_at
       FROM ai_trip_plan_feedback
       WHERE plan_id = $1
         AND tourist_id = $2
       ORDER BY created_at DESC
       LIMIT 1`,
      [planId, req.user.user_id]
    );

    return res.status(200).json({
      plan: planResult.rows[0],
      feedback: feedbackResult.rows[0] || null,
    });
  } catch (error) {
    console.error("Error fetching trip plan:", error);
    return res.status(500).json({ message: "Server error fetching trip plan" });
  }
};

export const submitTripPlanFeedback = async (req, res) => {
  if (!requireTourist(req, res)) return;

  try {
    const planId = parsePlanId(req.params.planId);
    if (!planId) {
      return res.status(400).json({ message: "Invalid plan id" });
    }

    const feedbackType = String(req.body.feedback_type || "").trim().toLowerCase();
    if (!ALLOWED_FEEDBACK_TYPES.has(feedbackType)) {
      return res.status(400).json({
        message: "feedback_type must be one of: like, dislike, edited, booked",
      });
    }

    const feedbackNotes = String(req.body.feedback_notes || "").trim();
    const editedPlan = req.body.edited_plan && typeof req.body.edited_plan === "object"
      ? req.body.edited_plan
      : null;

    const planCheck = await pool.query(
      `SELECT plan_id
       FROM ai_trip_plans
       WHERE plan_id = $1
         AND requester_user_id = $2
         AND requester_user_type = $3`,
      [planId, req.user.user_id, req.user.user_type]
    );

    if (!planCheck.rows.length) {
      return res.status(404).json({ message: "Trip plan not found" });
    }

    const feedbackResult = await pool.query(
      `INSERT INTO ai_trip_plan_feedback
         (plan_id, tourist_id, feedback_type, feedback_notes, edited_plan)
       VALUES ($1, $2, $3, $4, $5::jsonb)
       ON CONFLICT (plan_id, tourist_id)
       DO UPDATE SET
         feedback_type = EXCLUDED.feedback_type,
         feedback_notes = EXCLUDED.feedback_notes,
         edited_plan = EXCLUDED.edited_plan,
         created_at = CURRENT_TIMESTAMP
       RETURNING feedback_id, feedback_type, feedback_notes, edited_plan, created_at`,
      [
        planId,
        req.user.user_id,
        feedbackType,
        feedbackNotes ? feedbackNotes.slice(0, 2000) : null,
        editedPlan ? JSON.stringify(editedPlan) : null,
      ]
    );

    await pool.query(
      `UPDATE ai_trip_plans
       SET updated_at = CURRENT_TIMESTAMP
       WHERE plan_id = $1`,
      [planId]
    );

    return res.status(200).json({
      message: "Feedback saved successfully",
      feedback: feedbackResult.rows[0],
    });
  } catch (error) {
    console.error("Error saving trip plan feedback:", error);
    return res.status(500).json({ message: "Server error saving trip plan feedback" });
  }
};

export const deleteTripPlan = async (req, res) => {
  if (!requireTourist(req, res)) return;

  try {
    const planId = parsePlanId(req.params.planId);
    if (!planId) {
      return res.status(400).json({ message: "Invalid plan id" });
    }

    // Check ownership first
    const ownershipResult = await pool.query(
      `SELECT plan_id 
       FROM ai_trip_plans 
       WHERE plan_id = $1 AND requester_user_id = $2 AND requester_user_type = $3`,
      [planId, req.user.user_id, req.user.user_type]
    );

    if (!ownershipResult.rows.length) {
      return res.status(404).json({ message: "Trip plan not found" });
    }

    // Delete related feedback first
    await pool.query(`DELETE FROM ai_trip_plan_feedback WHERE plan_id = $1`, [planId]);

    // Delete plan
    const deleteResult = await pool.query(
      `DELETE FROM ai_trip_plans WHERE plan_id = $1 RETURNING plan_id`,
      [planId]
    );

    if (!deleteResult.rows.length) {
      return res.status(404).json({ message: "Trip plan not found" });
    }

    return res.status(200).json({ message: "Trip plan deleted successfully" });
  } catch (error) {
    if (error?.code === "53300") {
      return res.status(503).json({
        message: "Database is temporarily busy (too many connections). Please try again in a few seconds.",
      });
    }

    console.error("Error deleting trip plan:", error);
    return res.status(500).json({ message: "Server error deleting trip plan" });
  }
};
