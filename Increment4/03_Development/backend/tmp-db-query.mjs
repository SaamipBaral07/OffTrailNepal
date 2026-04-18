import dotenv from "dotenv";
import pg from "pg";

dotenv.config();
const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  host: process.env.DB_HOST,
  port: process.env.DB_PORT ? Number(process.env.DB_PORT) : undefined,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: false } : undefined
});

await client.connect();

const q = `
with payment_flags as (
  select
    p.booking_id,
    bool_or(p.payment_status = 'success') as has_success
  from payments p
  group by p.booking_id
),
bookings as (
  select
    b.booking_id,
    b.tourist_id,
    b.status,
    b.check_in_date,
    coalesce(pf.has_success, false) as has_success,
    (b.check_in_date::timestamp - now()) as time_to_checkin
  from homestay_bookings b
  left join payment_flags pf on pf.booking_id = b.booking_id
),
owned as (
  select booking_id, tourist_id
  from bookings
  where status = 'confirmed'
  order by booking_id
  limit 1
)
select json_build_object(
  'bookingIdOwned', (select booking_id from owned),
  'ownedTouristId', (select tourist_id from owned),
  'bookingIdNotOwned', (
    select b.booking_id
    from bookings b
    where b.tourist_id <> (select tourist_id from owned)
    order by b.booking_id
    limit 1
  ),
  'bookingIdUnpaid', (
    select b.booking_id
    from bookings b
    where b.has_success = false
    order by b.booking_id
    limit 1
  ),
  'bookingIdNotConfirmed', (
    select b.booking_id
    from bookings b
    where b.status <> 'confirmed'
    order by b.booking_id
    limit 1
  ),
  'bookingIdFull', (
    select b.booking_id
    from bookings b
    where b.status = 'confirmed'
      and b.has_success = true
      and b.time_to_checkin >= interval '72 hours'
    order by b.check_in_date asc, b.booking_id asc
    limit 1
  ),
  'bookingIdPartial', (
    select b.booking_id
    from bookings b
    where b.status = 'confirmed'
      and b.has_success = true
      and b.time_to_checkin >= interval '24 hours'
      and b.time_to_checkin < interval '72 hours'
    order by b.check_in_date asc, b.booking_id asc
    limit 1
  ),
  'bookingIdNoRefund', (
    select b.booking_id
    from bookings b
    where b.status = 'confirmed'
      and b.has_success = true
      and b.time_to_checkin >= interval '0 hours'
      and b.time_to_checkin < interval '24 hours'
    order by b.check_in_date asc, b.booking_id asc
    limit 1
  )
) as result;
`;

const { rows } = await client.query(q);
console.log(JSON.stringify(rows[0].result, null, 2));

await client.end();
