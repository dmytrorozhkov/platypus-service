CREATE TABLE platypus.organizations (
  id uuid PRIMARY KEY,
  display_name text NOT NULL,
  CONSTRAINT organizations_name_nonblank CHECK (display_name ~ '[^[:space:]]')
);

CREATE TABLE platypus.support_agents (
  id uuid PRIMARY KEY,
  display_name text NOT NULL,
  CONSTRAINT support_agents_name_nonblank CHECK (display_name ~ '[^[:space:]]')
);

CREATE TABLE platypus.tickets (
  id uuid PRIMARY KEY,
  number text NOT NULL UNIQUE,
  subject text NOT NULL,
  organization_id uuid NOT NULL REFERENCES platypus.organizations(id) ON DELETE RESTRICT,
  status text NOT NULL,
  assignee_id uuid REFERENCES platypus.support_agents(id) ON DELETE RESTRICT,
  created_at timestamptz(3) NOT NULL,
  updated_at timestamptz(3) NOT NULL,
  CONSTRAINT tickets_number_format CHECK (number ~ '^PS-[1-9][0-9]*$'),
  CONSTRAINT tickets_subject_nonblank CHECK (subject ~ '[^[:space:]]'),
  CONSTRAINT tickets_status_known CHECK (status IN ('New', 'In progress', 'Awaiting customer', 'Closed')),
  CONSTRAINT tickets_created_finite CHECK (isfinite(created_at)),
  CONSTRAINT tickets_updated_finite CHECK (isfinite(updated_at)),
  CONSTRAINT tickets_time_order CHECK (updated_at >= created_at)
);

CREATE INDEX tickets_created_number_idx ON platypus.tickets (created_at, number);
