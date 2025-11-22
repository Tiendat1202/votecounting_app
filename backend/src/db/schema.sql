-- Database schema for vote counting application

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(255) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  role VARCHAR(50) DEFAULT 'user' CHECK (role IN ('admin', 'user')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Sessions table
CREATE TABLE IF NOT EXISTS sessions (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  candidates TEXT[] NOT NULL,
  start_at TIMESTAMP NOT NULL,
  end_at TIMESTAMP NOT NULL,
  created_by INTEGER REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Uploads table
CREATE TABLE IF NOT EXISTS uploads (
  id SERIAL PRIMARY KEY,
  session_id INTEGER REFERENCES sessions(id) ON DELETE CASCADE,
  filename VARCHAR(255) NOT NULL,
  original_name VARCHAR(255) NOT NULL,
  file_path VARCHAR(500) NOT NULL,
  file_size INTEGER NOT NULL,
  mime_type VARCHAR(100),
  uploaded_by INTEGER REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_sessions_created_by ON sessions(created_by);
CREATE INDEX IF NOT EXISTS idx_uploads_session_id ON uploads(session_id);
CREATE INDEX IF NOT EXISTS idx_uploads_uploaded_by ON uploads(uploaded_by);

-- Insert default admin user (password: admin123)
-- ⚠️ SECURITY WARNING: This default admin user should be changed or removed in production!
-- For production deployments, either:
-- 1. Remove this INSERT statement and create admin users manually
-- 2. Use a secure setup script that generates random credentials
-- Password hash for 'admin123' using bcrypt with salt rounds 10
INSERT INTO users (username, email, password, role)
VALUES ('admin', 'admin@votecounting.com', '$2b$10$7Zw/9u5nWv.EeqoVxE.ZxebKxOegxDX/.bnDkoJdpUb4EHJ7af7Z6', 'admin')
ON CONFLICT (username) DO NOTHING;
