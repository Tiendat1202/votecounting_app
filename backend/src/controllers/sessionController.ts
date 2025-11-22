import { Response } from 'express';
import { query } from '../db';
import { AuthRequest } from '../middleware/auth';

export const getSessions = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const result = await query(`
      SELECT 
        s.id, 
        s.title, 
        s.candidates, 
        s.start_at, 
        s.end_at, 
        s.created_at,
        u.username as created_by_username
      FROM sessions s
      LEFT JOIN users u ON s.created_by = u.id
      ORDER BY s.created_at DESC
    `);

    res.json({ sessions: result.rows });
  } catch (error) {
    console.error('Get sessions error:', error);
    res.status(500).json({ error: 'Failed to fetch sessions' });
  }
};

export const createSession = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { title, candidates, startAt, endAt } = req.body;

    // Validation
    if (!title || !candidates || !startAt || !endAt) {
      res.status(400).json({ 
        error: 'Title, candidates, startAt, and endAt are required' 
      });
      return;
    }

    if (!Array.isArray(candidates) || candidates.length === 0) {
      res.status(400).json({ error: 'Candidates must be a non-empty array' });
      return;
    }

    const startDate = new Date(startAt);
    const endDate = new Date(endAt);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      res.status(400).json({ error: 'Invalid date format' });
      return;
    }

    if (endDate <= startDate) {
      res.status(400).json({ error: 'End date must be after start date' });
      return;
    }

    // Insert session
    const result = await query(
      `INSERT INTO sessions (title, candidates, start_at, end_at, created_by)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, title, candidates, start_at, end_at, created_at`,
      [title, candidates, startDate, endDate, req.user!.id]
    );

    res.status(201).json({ session: result.rows[0] });
  } catch (error) {
    console.error('Create session error:', error);
    res.status(500).json({ error: 'Failed to create session' });
  }
};
