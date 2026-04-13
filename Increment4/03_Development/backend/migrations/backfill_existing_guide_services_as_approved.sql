UPDATE guide_services
SET approval_status = 'approved',
    approval_rejection_reason = NULL,
    reviewed_at = COALESCE(reviewed_at, CURRENT_TIMESTAMP),
    updated_at = CURRENT_TIMESTAMP
WHERE approval_status IS NULL
   OR approval_status = 'pending';
