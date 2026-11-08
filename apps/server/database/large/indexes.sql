CREATE INDEX large_tickets_number_order_idx ON platypus.tickets
  ((length(substring(number FROM 4))), (substring(number FROM 4) COLLATE "C"));
CREATE INDEX large_tickets_created_order_idx ON platypus.tickets
  (created_at DESC, (length(substring(number FROM 4))), (substring(number FROM 4) COLLATE "C"));
CREATE INDEX large_tickets_updated_order_idx ON platypus.tickets
  (updated_at DESC, (length(substring(number FROM 4))), (substring(number FROM 4) COLLATE "C"));
CREATE INDEX large_tickets_status_created_idx ON platypus.tickets
  (status, created_at DESC);
CREATE INDEX large_tickets_organization_created_idx ON platypus.tickets
  (organization_id, created_at DESC);
CREATE INDEX large_tickets_assignee_created_idx ON platypus.tickets
  (assignee_id, created_at DESC);
