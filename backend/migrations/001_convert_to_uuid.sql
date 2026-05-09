-- Migration: Convert all IDs from VARCHAR to UUID
-- This script safely migrates the schema to use UUID for all primary keys

-- Step 1: Create new tables with UUID columns
-- User table (already has UUID in PK)
CREATE TABLE IF NOT EXISTS "user_new" (
  "userId" TEXT PRIMARY KEY NOT NULL,
  "fullName" varchar(120),
  "email" varchar(255) NOT NULL UNIQUE,
  "password" varchar(255) NOT NULL,
  "role" varchar(50) NOT NULL DEFAULT 'user',
  "status" varchar(20) NOT NULL DEFAULT 'pending',
  "approvedByUserId" TEXT,
  "approvedAt" datetime,
  "createdAt" datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "workUnit" varchar(255)
);

-- Copy data from old table to new
INSERT INTO "user_new" SELECT * FROM "user";

-- Drop old and rename new
DROP TABLE "user";
ALTER TABLE "user_new" RENAME TO "user";

-- VoteSession table
CREATE TABLE IF NOT EXISTS "sessions_new" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "name" varchar NOT NULL,
  "type" varchar NOT NULL,
  "candidates" text NOT NULL,
  "startAt" varchar NOT NULL,
  "endAt" varchar NOT NULL,
  "createdAt" datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdByUserId" TEXT,
  "createdByEmail" varchar(255),
  "createdByName" varchar(120),
  "seatsToElect" integer,
  "minWinningPercent" float DEFAULT 50,
  "closedEarlyAt" datetime,
  "closedEarlyByUserId" TEXT,
  "voteRule" varchar(100),
  "electionUnit" varchar(255),
  "location" varchar(255),
  "evaluationOptions" text,
  "totalVotes" integer NOT NULL DEFAULT 0,
  "validVotes" integer NOT NULL DEFAULT 0,
  "invalidVotes" integer NOT NULL DEFAULT 0,
  "createdBy" TEXT,
  CONSTRAINT "FK_28e79e52851ae6894f90f2cfc8b" FOREIGN KEY ("createdBy") REFERENCES "user" ("userId") ON DELETE NO ACTION ON UPDATE NO ACTION
);

INSERT INTO "sessions_new" SELECT * FROM "sessions";
DROP TABLE "sessions";
ALTER TABLE "sessions_new" RENAME TO "sessions";

-- SessionMember table (already has UUID in PK)
-- Candidate table (already has UUID in PK)
-- Vote table (already has UUID in PK)
-- VoteCandidate table
-- AuditLog table (already has UUID in PK)
-- No changes needed - they already use UUID or the structure is correct

-- Verify the migration
.schema user
.schema sessions
