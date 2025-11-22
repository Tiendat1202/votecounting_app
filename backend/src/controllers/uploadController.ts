import { Response } from 'express';
import { query } from '../db';
import { AuthRequest } from '../middleware/auth';
import path from 'path';
import fs from 'fs/promises';
import { config } from '../config';

export const uploadFile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { sessionId } = req.params;

    // Validate sessionId is a positive integer
    const sessionIdNum = parseInt(sessionId, 10);
    if (isNaN(sessionIdNum) || sessionIdNum <= 0) {
      res.status(400).json({ error: 'Invalid session ID' });
      return;
    }

    if (!req.file) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }

    // Verify session exists
    const sessionResult = await query('SELECT id FROM sessions WHERE id = $1', [sessionIdNum]);
    if (sessionResult.rows.length === 0) {
      // Delete uploaded file
      await fs.unlink(req.file.path);
      res.status(404).json({ error: 'Session not found' });
      return;
    }

    // Save upload metadata to database
    const result = await query(
      `INSERT INTO uploads (session_id, filename, original_name, file_path, file_size, mime_type, uploaded_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, session_id, filename, original_name, file_size, mime_type, created_at`,
      [
        sessionIdNum,
        req.file.filename,
        req.file.originalname,
        req.file.path,
        req.file.size,
        req.file.mimetype,
        req.user!.id,
      ]
    );

    res.status(201).json({ upload: result.rows[0] });
  } catch (error) {
    console.error('Upload file error:', error);
    res.status(500).json({ error: 'Failed to upload file' });
  }
};

export const getUploads = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { sessionId } = req.params;

    // Validate sessionId is a positive integer
    const sessionIdNum = parseInt(sessionId, 10);
    if (isNaN(sessionIdNum) || sessionIdNum <= 0) {
      res.status(400).json({ error: 'Invalid session ID' });
      return;
    }

    const result = await query(
      `SELECT 
        u.id, 
        u.session_id, 
        u.filename, 
        u.original_name, 
        u.file_size, 
        u.mime_type, 
        u.created_at,
        us.username as uploaded_by_username
      FROM uploads u
      LEFT JOIN users us ON u.uploaded_by = us.id
      WHERE u.session_id = $1
      ORDER BY u.created_at DESC`,
      [sessionIdNum]
    );

    res.json({ uploads: result.rows });
  } catch (error) {
    console.error('Get uploads error:', error);
    res.status(500).json({ error: 'Failed to fetch uploads' });
  }
};

export const deleteUpload = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { sessionId, filename } = req.params;

    // Validate sessionId is a positive integer
    const sessionIdNum = parseInt(sessionId, 10);
    if (isNaN(sessionIdNum) || sessionIdNum <= 0) {
      res.status(400).json({ error: 'Invalid session ID' });
      return;
    }

    // Validate filename to prevent path traversal attacks
    // Only allow alphanumeric, dots, dashes, and underscores
    const safeFilenameRegex = /^[a-zA-Z0-9._-]+$/;
    if (!filename || !safeFilenameRegex.test(filename)) {
      res.status(400).json({ error: 'Invalid filename' });
      return;
    }

    // Check for path traversal sequences
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      res.status(400).json({ error: 'Invalid filename' });
      return;
    }

    // Get upload info
    const result = await query(
      'SELECT id, file_path FROM uploads WHERE session_id = $1 AND filename = $2',
      [sessionIdNum, filename]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Upload not found' });
      return;
    }

    const upload = result.rows[0];

    // Delete file from filesystem
    try {
      await fs.unlink(upload.file_path);
    } catch (fileError) {
      console.error('File deletion error:', fileError);
      // Continue even if file doesn't exist
    }

    // Delete from database
    await query('DELETE FROM uploads WHERE id = $1', [upload.id]);

    res.json({ message: 'Upload deleted successfully' });
  } catch (error) {
    console.error('Delete upload error:', error);
    res.status(500).json({ error: 'Failed to delete upload' });
  }
};

export const deleteAllUploads = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { sessionId } = req.params;

    // Validate sessionId is a positive integer
    const sessionIdNum = parseInt(sessionId, 10);
    if (isNaN(sessionIdNum) || sessionIdNum <= 0) {
      res.status(400).json({ error: 'Invalid session ID' });
      return;
    }

    // Get all uploads for this session
    const result = await query(
      'SELECT id, file_path FROM uploads WHERE session_id = $1',
      [sessionIdNum]
    );

    // Delete all files
    for (const upload of result.rows) {
      try {
        await fs.unlink(upload.file_path);
      } catch (fileError) {
        console.error('File deletion error:', fileError);
        // Continue even if file doesn't exist
      }
    }

    // Delete from database
    await query('DELETE FROM uploads WHERE session_id = $1', [sessionIdNum]);

    res.json({ 
      message: 'All uploads deleted successfully', 
      deletedCount: result.rows.length 
    });
  } catch (error) {
    console.error('Delete all uploads error:', error);
    res.status(500).json({ error: 'Failed to delete uploads' });
  }
};
