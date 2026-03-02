# Changelog

All notable changes to this project will be documented in this file.

## [1.0.0] - 2024-02-26

### Added
- 🔐 Auth module with JWT authentication
- 👤 Users management
- 👥 Customers management
- 🚗 Vehicles management
- 📋 Orders management (OS)
- 📎 Files upload with Multer
- 💬 WhatsApp webhook integration
- 📧 Email notifications via Nodemailer
- ⏰ CRON jobs for automated tasks
- 📚 Swagger API documentation
- 🐳 Docker support
- 🗄️ PostgreSQL database with Prisma ORM

### Features
- JWT-based authentication with refresh tokens
- Password hashing with bcrypt
- Sequential order number generation
- File upload with size validation (max 5MB)
- WhatsApp message sending and webhook handling
- Email notifications for order status changes
- Automated order status updates via CRON
- Weekly reports generation

### API Endpoints
- `POST /auth/register` - Register new user
- `POST /auth/login` - Login and get JWT token
- `POST /users` - Create user
- `GET /users` - List users
- `POST /customers` - Create customer
- `GET /customers` - List customers
- `POST /vehicles` - Create vehicle
- `GET /vehicles` - List vehicles
- `POST /orders` - Create order (auto-generates number)
- `GET /orders` - List orders
- `POST /files/upload` - Upload files
- `POST /whatsapp/webhook` - WhatsApp webhook (public)
- `POST /whatsapp/send-message` - Send WhatsApp message
- `POST /emails/send` - Send email
