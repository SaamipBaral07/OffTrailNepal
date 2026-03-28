# OffTrail Nepal Access Matrix

## 1. Role Model

| Role | Purpose | Current System State |
|---|---|---|
| Tourist | Browse trails and consume services | Implemented (limited actions) |
| Guide | Offer guide services by trail | Implemented |
| Host | Offer homestays by trail | Implemented |
| Admin | Platform governance and approvals | Implemented |

## 2. Permission Legend

- `R` = Read/View
- `C` = Create
- `U` = Update
- `D` = Delete
- `A` = Approve/Moderate
- `M` = Manage (toggle status, assign, operational actions)
- `P` = Planned (future, not yet built)

## 3. Current Access Matrix (Implemented + Existing Gaps)

| Module / Capability | Tourist | Guide | Host | Admin | Status |
|---|---|---|---|---|---|
| Authentication (register/login/logout/reset) | C/R/U | C/R/U | C/R/U | C/R/U | Implemented |
| Own Profile / Account | R/U | R/U | R/U | R/U | Implemented |
| Public Trail Listing / Trail Details | R | R | R | R | Implemented |
| Trail Management (platform trails CRUD) | - | - | - | C/R/U/D | Implemented |
| Guide-Trail Assignment (own) | - | C/R/U/D/M | - | R | Implemented |
| Guide Service Packages (own) | - | C/R/U/D/M | - | R | Implemented |
| Guide Availability Calendar (own) | - | C/R/U/M | - | R | Implemented |
| Guide Reviews (view own) | - | R | - | R | Implemented |
| Homestay Management (own listings) | - | - | C/R/U/D/M | R | Implemented |
| Homestay Approval Workflow | - | - | R | A/R/U | Implemented |
| Tourist Dashboard Personal Actions (wishlist, plans, compare) | P | - | - | - | Gap (not built) |
| Booking / Reservation Execution | P | P | P | P | Gap (not built) |
| Payment Execution and Settlement | P | P | P | P | Gap (not built) |
| Order History and Receipts | P | P | P | P | Gap (not built) |

Notes:
- Tourist role is currently mostly read-only from a transactional perspective.
- Booking/payment are referenced by UX language but are not yet implemented as full backend flows.

## 4. Future Access Matrix (Recommended for Next Increments)

This section defines what should be added so future implementation follows clear role boundaries.

| Future Module | Tourist | Guide | Host | Admin | Recommended Scope |
|---|---|---|---|---|---|
| Booking Orders (Guide/Homestay) | C/R/U(cancel own) | R/U(confirm/reject own service bookings) | R/U(confirm/reject own homestay bookings) | R/A/U/D (override, dispute handling) | Core transactional module |
| Payments (online + wallet + COD fallback) | C (pay), R (payment status), R (refund status) | R (payout status) | R (payout status) | A/R/U (reconcile, refund, chargeback) | Integrate payment gateway + ledger |
| Refunds and Cancellations | C (request), R | R (respond on own order) | R (respond on own order) | A (final decision), U (policy enforcement) | Policy-driven workflow |
| Invoicing and Tax Records | R (invoice) | R (payout invoice) | R (payout invoice) | C/R/U/D (tax and compliance exports) | Compliance and accounting |
| Reviews and Ratings (full cycle) | C/R/U(delete own) | R/respond | R/respond | A/M (moderation) | Close trust loop |
| Messaging / Support Tickets | C/R/U (own tickets) | R/U (assigned conversations) | R/U (assigned conversations) | A/M (routing, SLA, closure) | Improves operational resolution |
| Promotions / Coupons | R/apply | R | R | C/R/U/D/A | Growth engine |
| Availability and Inventory Locks | R | C/R/U (own slots) | C/R/U (own inventory) | R/A (override locks) | Prevent double booking |
| Insurance Add-ons | C/R (purchase/status) | R | R | A/R/U (provider control) | Optional attach at checkout |
| Disputes and Fraud Monitoring | C (raise dispute) | C (raise dispute) | C (raise dispute) | A/R/U/D | Risk and trust control |
| Analytics and BI | R (personal spend/activity) | R (service performance) | R (occupancy/revenue) | R/A (platform-wide analytics) | Role-specific insights |

## 5. Suggested Access Policies (Implementation Rules)

1. Ownership rule:
- Guide and Host can modify only records they own.

2. Admin override rule:
- Admin can moderate and override in exceptional cases with audit logs.

3. Least privilege rule:
- Tourist cannot access provider operations.

4. Payment safety rule:
- Payment mutation endpoints require idempotency keys.

5. Booking integrity rule:
- Booking confirmation must check live availability lock before final commit.

6. Auditability rule:
- Keep immutable audit records for status transitions (order, payment, refund, dispute).

## 6. Recommended Data Entities for Future Modules

- `orders`
- `order_items`
- `order_status_history`
- `payments`
- `payment_attempts`
- `refunds`
- `payouts`
- `coupons`
- `applied_discounts`
- `support_tickets`
- `ticket_messages`
- `availability_locks`
- `audit_logs`
- `notifications`

## 7. Priority Rollout Plan

1. Booking Orders + Availability Locks
2. Payments + Refund Workflow
3. Order History + Invoices + Notifications
4. Reviews Full Cycle + Disputes
5. Coupons + Analytics

---

This matrix is aligned to the currently observed role architecture (tourist, guide, host, admin) and extended for payment/order-centric growth.
