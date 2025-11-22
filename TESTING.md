# Vote Counting Application - Testing Guide

## Quick Start

### Prerequisites
- Node.js (v16+)
- PostgreSQL (v12+)

### Backend Setup

1. Navigate to backend directory:
```bash
cd backend
```

2. Install dependencies:
```bash
npm install
```

3. Create PostgreSQL database:
```bash
createdb votecounting
```

4. Configure environment:
```bash
cp .env.example .env
# Edit .env with your database credentials
```

5. Start the server:
```bash
npm run dev
```

The server will run on `http://localhost:5050`

### Frontend Setup

1. Navigate to frontend directory:
```bash
cd frontend
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

The frontend will run on `http://localhost:3000`

## Testing the API

### 1. Health Check
```bash
curl http://localhost:5050/api/health
```

### 2. Login
```bash
curl -c cookies.txt -X POST http://localhost:5050/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "password": "admin123",
    "rememberMe": false
  }'
```

**Response:**
```json
{
  "user": {
    "id": 1,
    "username": "admin",
    "email": "admin@votecounting.com",
    "role": "admin"
  }
}
```

### 3. Get Current User
```bash
curl -b cookies.txt http://localhost:5050/api/auth/me
```

### 4. Create a Voting Session (Admin Only)
```bash
curl -b cookies.txt -X POST http://localhost:5050/api/sessions \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Presidential Election 2025",
    "candidates": ["Candidate A", "Candidate B", "Candidate C"],
    "startAt": "2025-01-01T00:00:00Z",
    "endAt": "2025-12-31T23:59:59Z"
  }'
```

### 5. Get All Sessions
```bash
curl -b cookies.txt http://localhost:5050/api/sessions
```

### 6. Upload Vote Image
```bash
curl -b cookies.txt -X POST http://localhost:5050/api/uploads/1 \
  -F "file=@/path/to/image.jpg"
```

### 7. Get Uploads for a Session
```bash
curl -b cookies.txt http://localhost:5050/api/uploads/1
```

### 8. Get Statistics
```bash
curl -b cookies.txt http://localhost:5050/api/stats
```

**Response:**
```json
{
  "stats": {
    "sessions": {
      "total": 5,
      "active": 2
    },
    "uploads": {
      "total": 42,
      "recent": 15,
      "totalSize": 5242880
    }
  }
}
```

### 9. Delete an Upload
```bash
curl -b cookies.txt -X DELETE http://localhost:5050/api/uploads/1/filename.jpg
```

### 10. Logout
```bash
curl -b cookies.txt -X POST http://localhost:5050/api/auth/logout
```

## Default Credentials

- **Username:** admin
- **Password:** admin123
- **Role:** admin

⚠️ **Important:** Change these credentials in production!

## Rate Limits

- **Login attempts:** 5 per 15 minutes
- **File uploads:** 10 per hour
- **General API calls:** 100 per 15 minutes

## Testing Rate Limiting

To test rate limiting, make multiple rapid requests:

```bash
for i in {1..10}; do
  curl -X POST http://localhost:5050/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"username": "admin", "password": "wrong"}' \
    -i | grep -i ratelimit
done
```

After 5 attempts, you should see:
```json
{"error": "Too many authentication attempts, please try again later."}
```

## Security Features

✅ JWT authentication with HTTP-only cookies  
✅ Role-based access control (admin/user)  
✅ Password hashing with bcrypt  
✅ Rate limiting on all endpoints  
✅ Input validation and sanitization  
✅ File type verification using magic bytes  
✅ CORS protection  
✅ SQL injection prevention (parameterized queries)  
✅ Path traversal protection  

## Troubleshooting

### Database Connection Failed
- Ensure PostgreSQL is running: `sudo service postgresql start`
- Check database credentials in `.env`
- Verify database exists: `psql -l | grep votecounting`

### Port Already in Use
- Change port in `.env`: `PORT=5051`
- Or kill existing process: `lsof -ti:5050 | xargs kill`

### File Upload Fails
- Check file size (max 10MB)
- Verify file type (only images: JPEG, PNG, GIF)
- Ensure uploads directory exists

## Development

### Build for Production
```bash
npm run build
npm start
```

### Project Structure
```
backend/
├── src/
│   ├── config/         # Configuration
│   ├── controllers/    # Business logic
│   ├── db/            # Database setup
│   ├── middleware/    # Express middleware
│   ├── routes/        # API routes
│   └── index.ts       # Entry point
├── uploads/           # File storage
└── dist/             # Compiled code
```

## API Documentation

For complete API documentation, see [README.md](./backend/README.md)  
For security information, see [SECURITY.md](./backend/SECURITY.md)
