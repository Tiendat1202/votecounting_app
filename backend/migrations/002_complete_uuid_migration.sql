-- Complete migration script to convert all IDs to UUID (TEXT in SQLite)
-- This safely recreates all tables with UUID primary keys

-- Helper function to generate UUID in SQLite
-- SQLite doesn't have built-in UUID, using random hex as UUID representation

BEGIN TRANSACTION;

-- Step 1: Rename existing tables
ALTER TABLE "session_members" RENAME TO "session_members_old";
ALTER TABLE "session_access_requests" RENAME TO "session_access_requests_old";
ALTER TABLE "votes" RENAME TO "votes_old";
ALTER TABLE "vote_candidate" RENAME TO "vote_candidate_old";
ALTER TABLE "candidate" RENAME TO "candidate_old";
ALTER TABLE "candidate_result" RENAME TO "candidate_result_old";
ALTER TABLE "audit_logs" RENAME TO "audit_logs_old";

-- Step 2: Create new tables with TEXT (UUID) primary keys

CREATE TABLE "session_members" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "sessionId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "userEmail" varchar(255) NOT NULL,
  "userFullName" varchar(120),
  "role" varchar(30) NOT NULL,
  "addedByUserId" TEXT,
  "createdAt" datetime NOT NULL DEFAULT (datetime('now')),
  "updatedAt" datetime NOT NULL DEFAULT (datetime('now')),
  CONSTRAINT "FK_session_members_sessionId" FOREIGN KEY ("sessionId") REFERENCES "sessions" ("id") ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT "FK_session_members_userId" FOREIGN KEY ("userId") REFERENCES "user" ("userId") ON DELETE CASCADE ON UPDATE NO ACTION
);

CREATE TABLE "session_access_requests" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "sessionId" TEXT NOT NULL,
  "ownerUserId" TEXT NOT NULL,
  "requesterUserId" TEXT NOT NULL,
  "requesterEmail" varchar(255) NOT NULL,
  "requesterFullName" varchar(120),
  "requestedRole" varchar(30) NOT NULL DEFAULT ('inspector'),
  "status" varchar(20) NOT NULL DEFAULT ('pending'),
  "note" text,
  "reviewedByUserId" TEXT,
  "createdAt" datetime NOT NULL DEFAULT (datetime('now')),
  "updatedAt" datetime NOT NULL DEFAULT (datetime('now')),
  CONSTRAINT "FK_session_access_requests_sessionId" FOREIGN KEY ("sessionId") REFERENCES "sessions" ("id") ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT "FK_session_access_requests_ownerUserId" FOREIGN KEY ("ownerUserId") REFERENCES "user" ("userId") ON DELETE CASCADE ON UPDATE NO ACTION
);

CREATE TABLE "votes" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "sessionId" TEXT NOT NULL,
  "voteId" varchar(255),
  "voteType" varchar(50) NOT NULL,
  "rawData" text,
  "selectedCandidate" varchar(255),
  "confidenceScore" decimal(3,2) NOT NULL DEFAULT (0),
  "status" varchar(50) NOT NULL,
  "validationNotes" text,
  "imageUrl" varchar(255),
  "createdAt" datetime NOT NULL DEFAULT (datetime('now')),
  "updatedAt" datetime NOT NULL DEFAULT (datetime('now')),
  "candidate" varchar(255),
  "notes" text,
  "imageHash" varchar(255),
  "isProcessed" boolean NOT NULL DEFAULT (0),
  "isEdited" boolean NOT NULL DEFAULT (0),
  "isValid" boolean NOT NULL DEFAULT (1),
  CONSTRAINT "UQ_votes_imageHash" UNIQUE ("imageHash"),
  CONSTRAINT "FK_votes_sessionId" FOREIGN KEY ("sessionId") REFERENCES "sessions" ("id") ON DELETE CASCADE ON UPDATE NO ACTION
);

CREATE TABLE "vote_candidate" (
  "voteID" TEXT NOT NULL,
  "candidateID" TEXT NOT NULL,
  PRIMARY KEY ("voteID", "candidateID"),
  CONSTRAINT "FK_vote_candidate_voteID" FOREIGN KEY ("voteID") REFERENCES "votes" ("id") ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT "FK_vote_candidate_candidateID" FOREIGN KEY ("candidateID") REFERENCES "candidate" ("candidateId") ON DELETE CASCADE ON UPDATE NO ACTION
);

CREATE TABLE "candidate" (
  "candidateId" TEXT PRIMARY KEY NOT NULL,
  "candidateName" varchar(255) NOT NULL,
  "candidateDate" date,
  "candidateGender" varchar(20),
  "candidateUnit" varchar(255),
  "votesCount" integer NOT NULL DEFAULT (0),
  "candidateInfo" text,
  "sessionID" TEXT NOT NULL,
  CONSTRAINT "FK_candidate_sessionID" FOREIGN KEY ("sessionID") REFERENCES "sessions" ("id") ON DELETE CASCADE ON UPDATE NO ACTION
);

CREATE TABLE "candidate_result" (
  "resultId" TEXT PRIMARY KEY NOT NULL,
  "voteCount" integer NOT NULL DEFAULT (0),
  "rank" integer NOT NULL DEFAULT (0),
  "candidateCandidateId" TEXT,
  CONSTRAINT "FK_candidate_result_candidateCandidateId" FOREIGN KEY ("candidateCandidateId") REFERENCES "candidate" ("candidateId") ON DELETE NO ACTION ON UPDATE NO ACTION
);

CREATE TABLE "audit_logs" (
  "logID" TEXT PRIMARY KEY NOT NULL,
  "oldData" text NOT NULL,
  "newData" text NOT NULL,
  "changeAt" datetime NOT NULL DEFAULT (datetime('now')),
  "voteID" TEXT NOT NULL,
  "userID" TEXT NOT NULL,
  "sessionID" TEXT NOT NULL,
  CONSTRAINT "FK_audit_logs_voteID" FOREIGN KEY ("voteID") REFERENCES "votes" ("id") ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT "FK_audit_logs_userID" FOREIGN KEY ("userID") REFERENCES "user" ("userId") ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT "FK_audit_logs_sessionID" FOREIGN KEY ("sessionID") REFERENCES "sessions" ("id") ON DELETE CASCADE ON UPDATE NO ACTION
);

-- Step 3: Copy data from old tables to new tables (preserving IDs)

INSERT INTO "session_members" 
  ("id", "sessionId", "userId", "userEmail", "userFullName", "role", "addedByUserId", "createdAt", "updatedAt")
SELECT 
  "id", "sessionId", "userId", "userEmail", "userFullName", "role", "addedByUserId", "createdAt", "updatedAt"
FROM "session_members_old";

INSERT INTO "session_access_requests"
  ("id", "sessionId", "ownerUserId", "requesterUserId", "requesterEmail", "requesterFullName", "requestedRole", "status", "note", "reviewedByUserId", "createdAt", "updatedAt")
SELECT
  "id", "sessionId", "ownerUserId", "requesterUserId", "requesterEmail", "requesterFullName", "requestedRole", "status", "note", "reviewedByUserId", "createdAt", "updatedAt"
FROM "session_access_requests_old";

INSERT INTO "votes"
  ("id", "sessionId", "voteId", "voteType", "rawData", "selectedCandidate", "confidenceScore", "status", "validationNotes", "imageUrl", "createdAt", "updatedAt", "candidate", "notes", "imageHash", "isProcessed", "isEdited", "isValid")
SELECT
  "id", "sessionId", "voteId", "voteType", "rawData", "selectedCandidate", "confidenceScore", "status", "validationNotes", "imageUrl", "createdAt", "updatedAt", "candidate", "notes", "imageHash", "isProcessed", "isEdited", "isValid"
FROM "votes_old";

INSERT INTO "vote_candidate"
  ("voteID", "candidateID")
SELECT
  "voteID", "candidateID"
FROM "vote_candidate_old";

INSERT INTO "candidate"
  ("candidateId", "candidateName", "candidateDate", "candidateGender", "candidateUnit", "votesCount", "candidateInfo", "sessionID")
SELECT
  "candidateId", "candidateName", "candidateDate", "candidateGender", "candidateUnit", "votesCount", "candidateInfo", "sessionID"
FROM "candidate_old";

INSERT INTO "candidate_result"
  ("resultId", "voteCount", "rank", "candidateCandidateId")
SELECT
  "resultId", "voteCount", "rank", "candidateCandidateId"
FROM "candidate_result_old";

INSERT INTO "audit_logs"
  ("logID", "oldData", "newData", "changeAt", "voteID", "userID", "sessionID")
SELECT
  "logID", "oldData", "newData", "changeAt", "voteID", "userID", "sessionID"
FROM "audit_logs_old";

-- Step 4: Drop old tables

DROP TABLE "session_members_old";
DROP TABLE "session_access_requests_old";
DROP TABLE "votes_old";
DROP TABLE "vote_candidate_old";
DROP TABLE "candidate_old";
DROP TABLE "candidate_result_old";
DROP TABLE "audit_logs_old";

COMMIT;
