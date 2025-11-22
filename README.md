# Vote Counting Application

A full-stack vote counting application with a React frontend and TypeScript/Express/PostgreSQL backend.

## 🚀 Features

### Backend (Port 5050)
- ✅ **Authentication System**: JWT-based auth with HTTP-only cookies
- ✅ **Remember Me**: 7-day persistent sessions
- ✅ **Role-Based Access**: Admin and user roles with protected routes
- ✅ **Session Management**: Create and manage voting sessions with candidates
- ✅ **File Uploads**: Secure image upload with validation
- ✅ **Dashboard Stats**: Real-time statistics for sessions and uploads
- ✅ **Security**: Rate limiting, input validation, CSRF protection
- ✅ **Database**: PostgreSQL with proper schema and relationships

### Frontend (Port 3000)
- React with TypeScript
- Vite for fast development
- Axios for API calls
- TypeScript API client with proper types

## 📋 Prerequisites

- Node.js v16 or higher
- PostgreSQL v12 or higher
- npm or yarn

## 🔧 Installation

### 1. Clone the Repository
```bash
git clone https://github.com/Tiendat1202/votecounting_app.git
cd votecounting_app
```

### 2. Setup Backend
```bash
cd backend
npm install
createdb votecounting
cp .env.example .env
# Edit .env with your database credentials
npm run dev
```

### 3. Setup Frontend
```bash
cd frontend
npm install
npm run dev
```

## 📚 API Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/api/health` | Health check | No |
| POST | `/api/auth/login` | Login | No |
| GET | `/api/auth/me` | Get current user | Yes |
| POST | `/api/auth/logout` | Logout | Yes |
| GET | `/api/sessions` | List sessions | Yes |
| POST | `/api/sessions` | Create session | Yes (Admin) |
| POST | `/api/uploads/:sessionId` | Upload image | Yes |
| GET | `/api/uploads/:sessionId` | List uploads | Yes |
| DELETE | `/api/uploads/:sessionId/:filename` | Delete upload | Yes |
| DELETE | `/api/uploads/:sessionId` | Delete all uploads | Yes |
| GET | `/api/stats` | Get statistics | Yes |

## 🔐 Security Features

- **JWT Authentication**: Secure token-based authentication
- **HTTP-Only Cookies**: Prevents XSS attacks
- **Password Hashing**: bcrypt with 10 rounds
- **Rate Limiting**: 
  - Login: 5 attempts per 15 minutes
  - Uploads: 10 per hour
  - API: 100 requests per 15 minutes
- **Input Validation**: All inputs sanitized and validated
- **File Validation**: Magic byte verification for uploads
- **SQL Injection Protection**: Parameterized queries
- **CORS**: Configured for specific origin

## 🧪 Testing

See [TESTING.md](./TESTING.md) for detailed testing instructions.

Quick test:
```bash
# Health check
curl http://localhost:5050/api/health

# Login
curl -c cookies.txt -X POST http://localhost:5050/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "admin123"}'
```

## 📁 Project Structure

```
votecounting_app/
├── backend/                # Express backend
│   ├── src/
│   │   ├── config/        # Configuration
│   │   ├── controllers/   # Route controllers
│   │   ├── db/           # Database setup
│   │   ├── middleware/   # Express middleware
│   │   ├── routes/       # API routes
│   │   └── index.ts      # Entry point
│   ├── uploads/          # File storage
│   └── package.json
├── frontend/              # React frontend
│   ├── src/
│   │   ├── api.ts        # API client
│   │   ├── App.tsx       # Main component
│   │   └── main.tsx      # Entry point
│   └── package.json
└── README.md             # This file
```

## 🔑 Default Credentials

- **Username**: admin
- **Password**: admin123
- **Role**: admin

⚠️ **Change these in production!**

## 🛠️ Development

### Backend
```bash
cd backend
npm run dev      # Development with hot reload
npm run build    # Build for production
npm start        # Run production build
```

### Frontend
```bash
cd frontend
npm run dev      # Development server
npm run build    # Build for production
npm run preview  # Preview production build
```

## 📄 Documentation

- [Backend README](./backend/README.md) - Backend documentation
- [Security](./backend/SECURITY.md) - Security considerations
- [Testing Guide](./TESTING.md) - Testing instructions

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📝 License

MIT License

## 👥 Authors

- Initial work by copilot-swe-agent

## 🐛 Known Issues

None at this time. Please report issues on GitHub.

## 🚀 Deployment

### Environment Variables

Backend `.env`:
```
PORT=5050
NODE_ENV=production
DB_HOST=your-db-host
DB_PORT=5432
DB_NAME=votecounting
DB_USER=your-db-user
DB_PASSWORD=your-db-password
JWT_SECRET=your-secure-secret-key
CORS_ORIGIN=https://your-frontend-domain.com
```

### Production Checklist

- [ ] Change default admin password
- [ ] Update JWT secret
- [ ] Configure HTTPS
- [ ] Set secure cookies (`secure: true`)
- [ ] Update CORS origin
- [ ] Set up proper logging
- [ ] Configure database backups
- [ ] Set up monitoring
- [ ] Review rate limits
- [ ] Enable CSRF tokens

## 📊 Database Schema

### Users
- id (serial, primary key)
- username (unique)
- email (unique)
- password (hashed)
- role (admin/user)
- created_at, updated_at

### Sessions
- id (serial, primary key)
- title
- candidates (array)
- start_at, end_at
- created_by (foreign key)
- created_at, updated_at

### Uploads
- id (serial, primary key)
- session_id (foreign key)
- filename, original_name
- file_path, file_size, mime_type
- uploaded_by (foreign key)
- created_at

## 💡 Tips

- Use the TypeScript API client in frontend for type safety
- Check rate limit headers in responses
- Review SECURITY.md before deployment
- Monitor upload directory size
- Regularly backup the database
