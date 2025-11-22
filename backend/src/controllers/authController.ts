import { Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { query } from '../db';
import { config } from '../config';
import { AuthRequest } from '../middleware/auth';

export const login = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { username, password, rememberMe } = req.body;

    if (!username || !password) {
      res.status(400).json({ error: 'Username and password are required' });
      return;
    }

    // Find user
    const result = await query(
      'SELECT id, username, email, password, role FROM users WHERE username = $1',
      [username]
    );

    if (result.rows.length === 0) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const user = result.rows[0];

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    // Generate JWT token
    const tokenPayload = {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
    };

    const token = jwt.sign(
      tokenPayload, 
      config.jwtSecret, 
      { expiresIn: rememberMe ? '7d' : '1h' }
    );

    // Set cookie
    const maxAge = rememberMe
      ? config.cookieRememberMeMaxAge
      : config.cookieStandardMaxAge;

    res.cookie(config.cookieName, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge,
    });

    res.json({
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
};

export const getMe = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    // Fetch fresh user data from database
    const result = await query(
      'SELECT id, username, email, role FROM users WHERE id = $1',
      [req.user.id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json({ user: result.rows[0] });
  } catch (error) {
    console.error('Get me error:', error);
    res.status(500).json({ error: 'Failed to get user information' });
  }
};

export const logout = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    // Clear cookie
    res.clearCookie(config.cookieName, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
    });

    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Logout failed' });
  }
};
