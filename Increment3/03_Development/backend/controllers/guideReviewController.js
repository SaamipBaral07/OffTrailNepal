import pool from "../config/db.js";

/* =========================
   GET MY REVIEWS
   GET /api/guides/reviews
========================= */
export const getMyReviews = async (req, res) => {
  try {
    const guideId = req.user.user_id;
    // fetch reviews with user details
    const result = await pool.query(
      `SELECT r.review_id, r.rating, r.comment, r.created_at, u.full_name as reviewer_name
       FROM guide_reviews r
       JOIN tourists u ON r.user_id = u.tourist_id
       WHERE r.guide_id = $1
       ORDER BY r.created_at DESC`,
      [guideId]
    );
    
    // Calculate average rating
    const avgResult = await pool.query(
      `SELECT ROUND(AVG(rating), 1) as avg_rating, COUNT(*) as total_reviews
       FROM guide_reviews WHERE guide_id = $1`, 
      [guideId]
    );

    res.status(200).json({ 
      reviews: result.rows,
      stats: avgResult.rows[0] || { avg_rating: 0, total_reviews: 0 }
    });
  } catch (err) {
    console.error("Error fetching reviews:", err);
    res.status(500).json({ message: "Server error fetching reviews" });
  }
};
