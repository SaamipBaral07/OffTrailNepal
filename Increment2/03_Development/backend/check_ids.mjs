import pool from './src/config/db.js';

const guides   = await pool.query('SELECT guide_id, full_name FROM guides ORDER BY guide_id');
const trails   = await pool.query('SELECT trail_id, trail_name FROM trekking_trails ORDER BY trail_id');
const tourists = await pool.query('SELECT tourist_id, full_name FROM tourists ORDER BY tourist_id');

console.log('=== GUIDES ===');
guides.rows.forEach(r => console.log(r.guide_id, r.full_name));
console.log('=== TRAILS ===');
trails.rows.forEach(r => console.log(r.trail_id, r.trail_name));
console.log('=== TOURISTS ===');
tourists.rows.forEach(r => console.log(r.tourist_id, r.full_name));

await pool.end();
