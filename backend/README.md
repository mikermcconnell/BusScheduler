# Scheduler2 Backend API

## Setup Instructions

### Prerequisites
- Node.js 18+ 
- PostgreSQL 14+
- npm or yarn

### Database Setup

1. **Install PostgreSQL** if not already installed
   - Windows: Download from https://www.postgresql.org/download/windows/
   - Mac: `brew install postgresql`
   - Linux: `sudo apt-get install postgresql`

2. **Create Database and User**
   ```sql
   -- Connect to PostgreSQL as superuser
   psql -U postgres

   -- Create database
   CREATE DATABASE scheduler2_db;

   -- Create user
   CREATE USER scheduler_user WITH PASSWORD 'your_secure_password_here';

   -- Grant privileges
   GRANT ALL PRIVILEGES ON DATABASE scheduler2_db TO scheduler_user;

   -- Exit psql
   \q
   ```

3. **Run Database Schema**
   ```bash
   # Navigate to backend directory
   cd backend

   # Run schema file
   psql -U scheduler_user -d scheduler2_db -f src/db/schema.sql
   ```

### Backend Setup

1. **Install Dependencies**
   ```bash
   cd backend
   npm install
   ```

2. **Configure Environment**
   ```bash
   # Copy environment template
   cp .env.example .env

   # Edit .env file with your database credentials and JWT secrets
   # IMPORTANT: Generate secure random strings for JWT secrets in production
   ```

3. **Start Development Server**
   ```bash
   npm run dev
   ```

   The server will start on http://localhost:5000

### Frontend Integration

1. **Configure Frontend Environment**
   ```bash
   # In the root directory
   cp .env.example .env.local

   # Ensure REACT_APP_API_URL points to your backend
   ```

2. **Start Frontend**
   ```bash
   npm start
   ```

## API Documentation

### Authentication Endpoints

- `POST /api/v1/auth/register` - Register new user
- `POST /api/v1/auth/login` - Login user
- `POST /api/v1/auth/refresh-token` - Refresh access token
- `POST /api/v1/auth/logout` - Logout user
- `GET /api/v1/auth/profile` - Get user profile
- `POST /api/v1/auth/change-password` - Change password

### Schedule Endpoints

- `GET /api/v1/schedules` - List schedules
- `GET /api/v1/schedules/:id` - Get schedule details
- `POST /api/v1/schedules` - Create schedule
- `PUT /api/v1/schedules/:id` - Update schedule
- `DELETE /api/v1/schedules/:id` - Delete schedule
- `POST /api/v1/schedules/:id/publish` - Publish schedule

### Route Endpoints

- `GET /api/v1/routes` - List routes
- `GET /api/v1/routes/:id` - Get route details
- `POST /api/v1/routes` - Create route
- `PUT /api/v1/routes/:id` - Update route
- `DELETE /api/v1/routes/:id` - Delete route

## User Roles

- **admin** - Full system access
- **scheduler** - Create/edit schedules and routes
- **operator** - View schedules, manage shifts
- **viewer** - Read-only access

## Security Features

- JWT-based authentication with refresh tokens
- Password hashing with bcrypt
- Rate limiting
- Input validation
- SQL injection prevention
- XSS protection via helmet
- CORS configuration

## Development Commands

```bash
# Start dev server with hot reload
npm run dev

# Build for production
npm run build

# Run production server
npm start

# Run database migrations
npm run migrate

# Seed database with sample data
npm run seed

# Run tests
npm test

# Lint code
npm run lint
```

## Production Deployment

1. Set secure environment variables
2. Use a process manager (PM2, systemd)
3. Set up reverse proxy (nginx, Apache)
4. Enable SSL/TLS
5. Configure firewall rules
6. Set up database backups
7. Configure logging and monitoring

## Troubleshooting

### Database Connection Issues
- Verify PostgreSQL is running
- Check database credentials in .env
- Ensure database exists and user has permissions

### Port Already in Use
- Change PORT in .env file
- Or kill the process using the port

### Token Issues
- Clear browser localStorage
- Ensure JWT secrets are set correctly
- Check token expiration settings