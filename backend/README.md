# Vote Counting Backend

A complete backend API for vote counting application built with TypeScript, Express, and PostgreSQL.

## Features

- 🔐 Authentication system with JWT + Cookie
- 🔒 Role-based access control (admin and user roles)
- 📅 Session management with candidates
- 📤 File upload management for vote images
- 📊 Dashboard statistics
- 🛡️ Password hashing with bcrypt
- 🗄️ PostgreSQL database
- ✅ Request validation and error handling

## Prerequisites

- Node.js (v16 or higher)
- PostgreSQL (v12 or higher)

## Installation

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables:
```bash
cp .env.example .env
# Edit .env with your database credentials and JWT secret
```

3. Create PostgreSQL database:
```bash
createdb votecounting
```

4. The database schema will be automatically initialized when you start the server.

## Running the Server

Development mode:
```bash
npm run dev
```

Build for production:
```bash
npm run build
npm start
```

## API Endpoints

### Authentication
- `POST /api/auth/login` - Login with credentials (supports "remember me")
- `GET /api/auth/me` - Get current user information
- `POST /api/auth/logout` - Logout and clear session

### Sessions
- `GET /api/sessions` - Get all voting sessions
- `POST /api/sessions` - Create new session (admin only)

### Uploads
- `POST /api/uploads/:sessionId` - Upload vote image
- `GET /api/uploads/:sessionId` - Get uploads for session
- `DELETE /api/uploads/:sessionId/:filename` - Delete specific upload
- `DELETE /api/uploads/:sessionId` - Delete all uploads for session

### Statistics
- `GET /api/stats` - Get dashboard statistics

### Health
- `GET /api/health` - Health check endpoint

## Default Admin Credentials

- Username: `admin`
- Password: `admin123`

**⚠️ Important: Change the default admin password in production!**

## Environment Variables

See `.env.example` for all available configuration options.

## Project Structure

```
backend/
├── src/
│   ├── config/         # Configuration files
│   ├── controllers/    # Route controllers
│   ├── db/            # Database connection and schema
│   ├── middleware/    # Express middleware
│   ├── routes/        # API routes
│   └── index.ts       # Application entry point
├── uploads/           # File upload directory
└── dist/             # Compiled JavaScript (generated)
```

## License

MIT
