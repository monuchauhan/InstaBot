# InstaBot - Instagram Automation Platform

A full-stack application for automating Instagram comment replies and direct messages. Built with FastAPI, React/TypeScript, Celery, PostgreSQL, and Redis.

## Features

- 🔐 **User Authentication**: JWT-based authentication with secure password hashing
- 📱 **Instagram OAuth**: Connect Instagram Professional accounts via Meta's OAuth flow
- 💬 **Auto-Reply Comments**: Automatically reply to comments based on trigger keywords
- ✉️ **Send DMs**: Automatically send DMs to commenters (respects Instagram's 24-hour rule)
- 📊 **Activity Logs**: View all automation activities and events
- 🐳 **Docker Ready**: Full Docker Compose setup for easy deployment

## Tech Stack

### Backend
- **FastAPI** - Modern Python web framework with async support
- **SQLAlchemy** - Async ORM for PostgreSQL
- **Celery** - Distributed task queue for background processing
- **Redis** - Message broker and result backend for Celery
- **PostgreSQL** - Robust relational database

### Frontend
- **React 18** - UI library
- **TypeScript** - Type-safe JavaScript
- **React Router** - Client-side routing
- **Axios** - HTTP client

### Infrastructure
- **Docker & Docker Compose** - Container orchestration
- **Nginx** - Web server for frontend

## Project Structure

```
InstaBot/
├── backend/
│   ├── app/
│   │   ├── api/           # API routes
│   │   ├── core/          # Config, security, encryption
│   │   ├── db/            # Database models and connection
│   │   ├── schemas/       # Pydantic schemas
│   │   ├── services/      # Business logic
│   │   ├── worker/        # Celery tasks
│   │   └── main.py        # FastAPI application
│   ├── Dockerfile
│   ├── Dockerfile.worker
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── components/    # Reusable components
│   │   ├── contexts/      # React contexts
│   │   ├── pages/         # Page components
│   │   ├── services/      # API service
│   │   └── types/         # TypeScript types
│   ├── Dockerfile
│   └── package.json
├── docker-compose.yml
├── docker-compose.dev.yml
├── postman_collection.json
└── README.md
```

## Prerequisites

- Docker and Docker Compose
- Meta Developer Account (for Instagram API)
- Instagram Professional Account (Business or Creator)
- Facebook Page connected to Instagram account

## Quick Start

### 1. Clone and Configure

```bash
# Copy environment example
cp .env.example .env

# Edit .env with your credentials
nano .env
```

### 2. Configure Meta/Instagram App

1. Go to [Meta for Developers](https://developers.facebook.com/)
2. Create a new app or use an existing one
3. Add Instagram Graph API and Webhooks products
4. Configure OAuth redirect URI: `http://localhost:3000/auth/instagram/callback`
5. Add required permissions:
   - `instagram_basic`
   - `instagram_manage_comments`
   - `instagram_manage_messages`
   - `pages_show_list`
   - `pages_read_engagement`
6. Set up webhook subscription for Instagram comments

### 3. Start the Application

```bash
# Production mode
docker-compose up -d

# Development mode (with hot reload)
docker-compose -f docker-compose.dev.yml up
```

### 4. Access the Application

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8000
- **API Docs**: http://localhost:8000/api/v1/docs

---

## 🚀 Production Deployment (SaaS)

This application is designed to run as a multi-tenant SaaS platform. Follow these steps for production deployment:

### 1. Server Requirements

- Ubuntu 20.04+ or similar Linux distribution
- Docker and Docker Compose installed
- Domain name with DNS configured
- SSL certificate (Let's Encrypt/Certbot)
- Minimum 2GB RAM, 2 vCPU

### 2. Configure Production Environment

```bash
# Copy production environment template
cp .env.production.example .env

# Edit with your production values
nano .env

# Key settings to configure:
# - SECRET_KEY, JWT_SECRET_KEY, ENCRYPTION_KEY (generate secure random values)
# - DATABASE_URL (your PostgreSQL connection)
# - REDIS_PASSWORD (strong password)
# - META_APP_ID, META_APP_SECRET (from Meta Developer Console)
# - SMTP_* settings (for email verification)
# - FRONTEND_URL, BACKEND_URL (your production domains)
```

### 3. Update Nginx Configuration

```bash
# Edit nginx/nginx.prod.conf
# Replace yourdomain.com with your actual domain
nano nginx/nginx.prod.conf
```

### 4. SSL Certificate Setup

```bash
# Create directories for Let's Encrypt
mkdir -p nginx/certbot/conf nginx/certbot/www

# Start nginx for certificate challenge
docker-compose -f docker-compose.prod.yml up -d nginx

# Request certificate
docker-compose -f docker-compose.prod.yml run --rm certbot \
  certonly --webroot -w /var/www/certbot \
  -d yourdomain.com -d www.yourdomain.com

# Restart nginx with SSL
docker-compose -f docker-compose.prod.yml up -d nginx
```

### 5. Deploy Production Stack

```bash
# Build and start all services
docker-compose -f docker-compose.prod.yml up -d --build

# Run database migrations
docker-compose -f docker-compose.prod.yml exec backend \
  alembic upgrade head

# View logs
docker-compose -f docker-compose.prod.yml logs -f
```

### 6. Configure Meta App for Production

1. In Meta Developer Console, update OAuth redirect URI:
   - `https://yourdomain.com/auth/instagram/callback`
2. Add your domain to App Domains
3. Update webhook callback URL:
   - `https://yourdomain.com/api/v1/webhooks/instagram`
4. Complete App Review for public access

### 7. Scale for Traffic

```bash
# Scale workers for higher throughput
docker-compose -f docker-compose.prod.yml up -d --scale worker=5
```

---

## Subscription Tiers

The platform supports three subscription tiers:

| Feature | Free | Pro ($29/mo) | Enterprise ($99/mo) |
|---------|------|--------------|---------------------|
| Instagram Accounts | 1 | 5 | Unlimited |
| Automations | 2 | 10 | Unlimited |
| Auto-reply Comments | ✅ | ✅ | ✅ |
| Send DMs | ❌ | ✅ | ✅ |
| Analytics | ❌ | ✅ | ✅ |
| Daily Actions | 50 | 500 | Unlimited |
| API Access | ❌ | ❌ | ✅ |
| Support | Basic | Priority | Dedicated |

---

## Environment Variables

| Variable | Description |
|----------|-------------|
| `SECRET_KEY` | Application secret key |
| `JWT_SECRET_KEY` | JWT signing key |
| `ENCRYPTION_KEY` | Token encryption key (32 bytes) |
| `DATABASE_URL` | PostgreSQL connection URL |
| `REDIS_URL` | Redis connection URL |
| `META_APP_ID` | Meta/Facebook App ID |
| `META_APP_SECRET` | Meta/Facebook App Secret |
| `META_WEBHOOK_VERIFY_TOKEN` | Webhook verification token |
| `INSTAGRAM_REDIRECT_URI` | OAuth redirect URI |

## API Endpoints

### Authentication
- `POST /api/v1/auth/register` - Register new user
- `POST /api/v1/auth/login` - Login (OAuth2 password flow)
- `POST /api/v1/auth/login/json` - Login (JSON body)
- `POST /api/v1/auth/refresh` - Refresh access token
- `GET /api/v1/auth/me` - Get current user
- `PUT /api/v1/auth/me` - Update current user

### Instagram
- `GET /api/v1/instagram/connect-url` - Get OAuth URL
- `POST /api/v1/instagram/callback` - Handle OAuth callback
- `GET /api/v1/instagram/accounts` - List connected accounts
- `GET /api/v1/instagram/accounts/{id}` - Get account details
- `DELETE /api/v1/instagram/accounts/{id}` - Disconnect account

### Automations
- `GET /api/v1/automations` - List automations
- `POST /api/v1/automations` - Create automation
- `GET /api/v1/automations/{id}` - Get automation
- `PUT /api/v1/automations/{id}` - Update automation
- `DELETE /api/v1/automations/{id}` - Delete automation
- `POST /api/v1/automations/{id}/toggle` - Toggle automation

### Logs
- `GET /api/v1/logs` - Get action logs (paginated)

### Webhooks
- `GET /api/v1/webhooks/instagram` - Verify webhook subscription
- `POST /api/v1/webhooks/instagram` - Handle webhook events

## Database Schema

### Users
- Stores user accounts with hashed passwords
- Related to Instagram accounts and automation settings

### Instagram Accounts
- Stores connected Instagram Professional accounts
- Access tokens are encrypted before storage
- Tracks token expiration for automatic refresh

### Automation Settings
- Configures auto-reply and DM automations
- Supports trigger keywords for conditional automation
- Can be enabled/disabled per automation

### Action Logs
- Records all automation activities
- Tracks success/failure status
- Stores message details and error information

## Webhook Processing

1. Instagram sends comment events to `/api/v1/webhooks/instagram`
2. Webhook signature is verified using HMAC SHA-256
3. Event is queued as a Celery task
4. Worker processes the event:
   - Checks for matching automation settings
   - Verifies trigger keywords (if configured)
   - Posts comment reply via Instagram API
   - Sends DM if configured (respects 24-hour rule)
5. Action is logged to database

## Scaling

The application is designed for horizontal scaling:

- **Backend**: Stateless, can run multiple instances behind a load balancer
- **Workers**: Can run multiple Celery workers for parallel processing
- **Database**: PostgreSQL with connection pooling
- **Redis**: Can be clustered for high availability

```bash
# Scale workers
docker-compose up -d --scale worker=3
```

## Security Considerations

- All passwords are hashed using bcrypt
- Instagram access tokens are encrypted using Fernet (AES-256)
- JWT tokens with configurable expiration
- CORS configured for frontend origin only
- Webhook signatures verified using HMAC SHA-256

## Testing

Import the Postman collection (`postman_collection.json`) to test API endpoints.

```bash
# Run backend tests
cd backend
pytest

# Run frontend tests
cd frontend
npm test
```

## License

MIT License

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Open a Pull Request
