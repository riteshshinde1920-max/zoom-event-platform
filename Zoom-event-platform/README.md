# 🎯 Zoom Event Platform

A complete virtual event platform with Zoom integration, featuring real-time analytics, subscription management, and enterprise-grade security.

## 🚀 Features

- **Complete Zoom Integration** - Server-to-Server OAuth with automatic meeting creation
- **Three-Tier Subscription System** - Trial, Standard, and Pro plans with usage limits
- **Real-Time Analytics** - Live participant tracking and comprehensive reporting
- **Enterprise Security** - JWT authentication, rate limiting, and CORS protection
- **Professional API** - 50+ RESTful endpoints for all functionality
- **File Management** - Upload and manage event resources and user avatars

## 🏗️ Architecture

### Backend (Node.js + Express)
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: JWT with bcrypt password hashing
- **API**: RESTful endpoints with comprehensive validation
- **Security**: Helmet.js, CORS, rate limiting, input sanitization

### Zoom Integration
- **Server-to-Server OAuth** for secure API access
- **Meeting Management** - Create, update, delete, start, end meetings
- **Real-time Webhooks** for live event tracking
- **Participant Management** and recording access

## 🚦 Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL database
- Zoom Developer Account with Server-to-Server OAuth app

### Environment Variables
```bash
NODE_ENV=production
DATABASE_URL=postgresql://user:password@host:port/database
JWT_SECRET=your-secure-jwt-secret
FRONTEND_URL=https://yourdomain.com
ZOOM_ACCOUNT_ID=your_zoom_account_id
ZOOM_CLIENT_ID=your_zoom_client_id
ZOOM_CLIENT_SECRET=your_zoom_client_secret
```

### Installation
```bash
# Install dependencies
cd backend
npm install

# Run database migrations
npx prisma migrate deploy

# Start server
npm start
```

## 📚 API Documentation

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `GET /api/auth/me` - Get current user

### Events Management
- `POST /api/events` - Create event (auto-creates Zoom meeting)
- `GET /api/events` - List user's events
- `GET /api/events/:id` - Get event details
- `PUT /api/events/:id` - Update event
- `DELETE /api/events/:id` - Delete event

### Zoom Integration
- `GET /api/zoom/auth/token` - Get Zoom access token
- `POST /api/zoom/meetings` - Create Zoom meeting
- `GET /api/zoom/meetings` - List meetings
- `GET /api/zoom/meetings/:id` - Get meeting details

### Analytics
- `GET /api/analytics/dashboard` - Dashboard overview
- `GET /api/analytics/events/:id` - Event-specific analytics
- `GET /api/analytics/events/:id/realtime` - Real-time stats

### Subscriptions
- `GET /api/subscriptions/current` - Current subscription
- `POST /api/subscriptions/upgrade` - Upgrade plan
- `GET /api/subscriptions/check-limits` - Check usage limits

## 🎭 Subscription Plans

| Plan | Events | Attendees | Price |
|------|--------|-----------|-------|
| Trial | 3 | 12 | Free |
| Standard | 10 | 250 | $29.99/month |
| Pro | Unlimited | 500 | $99.99/month |

## 🔒 Security Features

- **JWT Authentication** with secure token management
- **Password Hashing** using bcrypt with 12 rounds
- **Rate Limiting** to prevent abuse and DDoS attacks
- **CORS Protection** with configurable origins
- **Input Validation** on all endpoints
- **Helmet.js** security headers
- **Webhook Verification** for Zoom events

## 📊 Analytics & Reporting

- **Real-time Participant Tracking** - Live join/leave events
- **Engagement Metrics** - Completion rates, attendance patterns
- **Dashboard Overview** - Comprehensive statistics and trends
- **Export Functionality** - JSON and CSV data export
- **Event Timeline** - Detailed activity logs

## 🚀 Deployment

### Railway (Recommended)
1. Connect GitHub repository to Railway
2. Add PostgreSQL database service
3. Set environment variables
4. Deploy automatically

### Heroku
```bash
heroku create your-app-name
heroku addons:create heroku-postgresql:essential-0
git push heroku main
```

### DigitalOcean App Platform
Use the provided `.do/app.yaml` configuration file.

### Render
Use the provided `render.yaml` configuration file.

## 🧪 Testing

### Health Check
```bash
curl https://your-domain.com/health
```

### User Registration
```bash
curl -X POST "https://your-domain.com/api/auth/register" \
  -H "Content-Type: application/json" \
  -d '{"name":"Test User","email":"test@example.com","password":"password123"}'
```

### Create Event
```bash
curl -X POST "https://your-domain.com/api/events" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{"title":"Test Event","startTime":"2024-12-01T15:00:00Z","endTime":"2024-12-01T16:00:00Z"}'
```

## 📁 Project Structure

```
zoom-event-platform/
├── backend/                    # Node.js backend
│   ├── prisma/                # Database schema & migrations
│   ├── routes/                # API endpoints
│   ├── services/              # Business logic
│   ├── middleware/            # Security & utilities
│   └── server.js              # Main application
├── scripts/                   # Deployment scripts
├── .do/                       # DigitalOcean configuration
├── render.yaml               # Render configuration
└── Procfile                  # Heroku configuration
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License.

## 🆘 Support

For support and questions:
- Check the deployment guides in the repository
- Review the testing documentation
- Open an issue on GitHub

## 🎉 Features Comparison

| Feature | OBV.io | This Platform |
|---------|--------|---------------|
| Zoom Integration | ✅ | ✅ Complete |
| Subscription Tiers | ✅ | ✅ 3 Tiers |
| Real-time Analytics | ✅ | ✅ Advanced |
| API Access | Limited | ✅ Full REST API |
| Custom Deployment | ❌ | ✅ Multiple Options |
| Open Source | ❌ | ✅ MIT License |

**Built with ❤️ for the virtual events community**