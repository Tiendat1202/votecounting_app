import { Response } from 'express';
import { query } from '../db';
import { AuthRequest } from '../middleware/auth';

export const getStats = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    // Get session counts
    const sessionsResult = await query('SELECT COUNT(*) as total FROM sessions');
    const totalSessions = parseInt(sessionsResult.rows[0].total);

    // Get active sessions (current time between start_at and end_at)
    const activeSessionsResult = await query(`
      SELECT COUNT(*) as active 
      FROM sessions 
      WHERE start_at <= NOW() AND end_at >= NOW()
    `);
    const activeSessions = parseInt(activeSessionsResult.rows[0].active);

    // Get upload counts
    const uploadsResult = await query('SELECT COUNT(*) as total FROM uploads');
    const totalUploads = parseInt(uploadsResult.rows[0].total);

    // Get total upload size
    const uploadSizeResult = await query('SELECT SUM(file_size) as total_size FROM uploads');
    const totalUploadSize = parseInt(uploadSizeResult.rows[0].total_size || '0');

    // Get recent uploads (last 7 days)
    const recentUploadsResult = await query(`
      SELECT COUNT(*) as recent 
      FROM uploads 
      WHERE created_at >= NOW() - INTERVAL '7 days'
    `);
    const recentUploads = parseInt(recentUploadsResult.rows[0].recent);

    res.json({
      stats: {
        sessions: {
          total: totalSessions,
          active: activeSessions,
        },
        uploads: {
          total: totalUploads,
          recent: recentUploads,
          totalSize: totalUploadSize,
        },
      },
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
};
