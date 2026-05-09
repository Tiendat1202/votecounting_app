-- Migration: Drop session_access_requests table
-- Date: 2026-05-10
-- Reason: Removing access request feature - using direct assignment instead

DROP TABLE IF EXISTS "session_access_requests";
