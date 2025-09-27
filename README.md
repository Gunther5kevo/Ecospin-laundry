# EcoSpin Laundry Management System

A comprehensive laundry management system with manual M-Pesa payment processing, order tracking, and admin dashboard.

## Features

- **Customer Order Management**: Create and track laundry orders
- **Manual M-Pesa Payment Processing**: Accept payments with manual confirmation
- **Admin Dashboard**: Protected admin interface for order management
- **Email Notifications**: Automated email alerts for new orders and status updates
- **Order Status Tracking**: Complete order lifecycle management
- **Data Export**: CSV export and JSON backup functionality
- **Database Persistence**: PostgreSQL integration for reliable data storage
- **Responsive Design**: Works on desktop and mobile devices

## Tech Stack

**Backend:**
- Node.js with Express.js
- PostgreSQL database
- Nodemailer for email notifications
- Basic authentication for admin access

**Frontend:**
- Vanilla HTML/CSS/JavaScript
- Responsive design
- Real-time order status updates

**Deployment:**
- Render.com (Backend + Database)
- Netlify (Frontend - optional)

## Project Structure

```
ecospin-laundry/
├── server.js                 # Main server file
├── package.json              # Dependencies and scripts
├── migrate-to-db.js          # Migration script (JSON to DB)

├── middleware/
│   └── basicAuth.js          # Authentication middleware
├── public/                   # Customer-facing website
│   ├── index.html
│   ├── styles.css
│   └── script.js
├── admin/                    # Admin dashboard
│   ├── index.html
│   ├── styles.css
│   └── script.js
├── data/                     # JSON backups (legacy)
│   ├── orders.json
│   └── counter.json
└── README.md
```

## Installation & Setup

### Prerequisites

- Node.js (v18 or higher)
- PostgreSQL database
- Gmail account for email notifications
 *working on  whatsapp and sms notification 

### Local Development

1. **Clone the repository:**
```bash
git clone https://github.com/Gunther5kevo/Ecospin-laundry.git
cd ecospin-laundry
```

2. **Install dependencies:**
```bash
npm install
```

3. **Set up PostgreSQL:**

**Option A: Local PostgreSQL**
```bash
# Install PostgreSQL and create database
createdb ecospin_laundry_dev
```

**Option B: Docker (Recommended)**
```bash
docker-compose up -d
```

4. **Create environment file (.env):**
```bash
# Database
DATABASE_URL=postgresql://postgres:password123@localhost:5432/ecospin_laundry_dev
NODE_ENV=development

# Email Configuration
EMAIL_USER=your-gmail@gmail.com
EMAIL_PASS=your-gmail-app-password

# Business Configuration
BUSINESS_NUMBER=+254700123456
ADMIN_EMAIL=admin@yourdomain.com

# Server
PORT=3000
```

5. **Start the server:**
```bash
npm start
```

6. **Access the application:**
- Website: http://localhost:3000
- Admin Dashboard: http://localhost:3000/admin (username: admin, password: your-choice)

### Production Deployment

#### Render.com Deployment

1. **Create PostgreSQL Database:**
   - Go to Render Dashboard
   - Create new PostgreSQL database (Free tier available)
   - Copy the connection string

2. **Deploy Backend:**
   - Connect your GitHub repository
   - Set environment variables:
     ```
     DATABASE_URL=<your-postgres-connection-string>
     NODE_ENV=production
     EMAIL_USER=<your-gmail>
     EMAIL_PASS=<your-gmail-app-password>
     BUSINESS_NUMBER=<your-mpesa-number>
     ADMIN_EMAIL=<admin-email>
     ```

3. **Deploy Frontend (Optional - Netlify):**
   - Deploy `public/` folder to Netlify
   - Update API URLs in frontend code

## Configuration

### Email Setup

1. **Enable Gmail 2FA**
2. **Generate App Password:**
   - Google Account Settings > Security > App Passwords
   - Create password for "Mail"
3. **Add to environment variables**

### Admin Authentication

Update `middleware/basicAuth.js` with your credentials:
```javascript
const ADMIN_USERNAME = 'admin';
const ADMIN_PASSWORD = 'your-secure-password';
```

### M-Pesa Configuration

Set your M-Pesa business number in environment variables:
```bash
BUSINESS_NUMBER=+254700123456
```

## API Endpoints

### Public Endpoints

- `POST /api/create-order` - Create new order
- `GET /api/order/:orderId` - Get order status
- `GET /api/health` - Health check

### Admin Endpoints (Protected)

- `GET /api/orders` - List all orders with summary
- `POST /api/confirm-payment/:orderId` - Mark order as paid
- `PUT /api/order/:orderId/status` - Update order status
- `DELETE /api/order/:orderId` - Delete order
- `GET /api/export/csv` - Export orders to CSV
- `GET /api/backup` - Download JSON backup

### Database Management

- `GET /api/db/status` - Database connection and stats
- `POST /api/db/refresh-cache` - Refresh in-memory cache
- `GET /api/db/stats` - Revenue and monthly statistics

## Order Status Flow

1. **pending_payment** - Order created, awaiting payment
2. **paid** - Payment confirmed
3. **pickup_scheduled** - Pickup arranged
4. **picked_up** - Items collected
5. **in_progress** - Currently being processed
6. **ready_for_delivery** - Ready for return
7. **delivered** - Order completed

## Data Migration

If migrating from JSON files to database:

```bash
# Ensure your data/ folder contains orders.json and counter.json
node migrate-to-db.js
```

## Troubleshooting

### Database Connection Issues

**Permission denied for schema public:**
```bash
psql -U postgres -d your_database
GRANT ALL PRIVILEGES ON SCHEMA public TO postgres;
GRANT CREATE ON SCHEMA public TO postgres;
```

**Connection refused:**
- Verify PostgreSQL is running
- Check DATABASE_URL format
- Ensure port 5432 is accessible

### Email Issues

**Authentication failed:**
- Use Gmail App Password, not regular password
- Enable 2FA on Gmail account
- Check EMAIL_USER and EMAIL_PASS variables

### Deployment Issues

**Render deployment fails:**
- Check environment variables are set
- Verify DATABASE_URL is correct
- Review build logs for specific errors

## Environment Variables Reference

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@host:5432/db` |
| `NODE_ENV` | Environment mode | `development` or `production` |
| `EMAIL_USER` | Gmail address | `your-email@gmail.com` |
| `EMAIL_PASS` | Gmail app password | `abcd efgh ijkl mnop` |
| `BUSINESS_NUMBER` | M-Pesa business number | `+254700123456` |
| `ADMIN_EMAIL` | Admin notification email | `admin@yourdomain.com` |
| `PORT` | Server port | `3000` |

## Security Considerations

- Admin dashboard is protected with basic authentication
- Environment variables store sensitive data
- Database connections use SSL in production
- No sensitive data logged to console

## Performance Features

- In-memory caching for fast reads
- Database persistence for reliability
- Automatic cache refresh every 10 minutes
- Indexed database queries
- Graceful shutdown handling

## Backup Strategy

- Automatic PostgreSQL backups on Render
- Manual backup endpoint: `/api/backup`
- CSV export functionality: `/api/export/csv`
- Migration scripts for data portability

## Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For support and questions:
- Check the troubleshooting section
- Review API documentation
- Contact: [kipyegokevin82@gmail.com]

## Version History

- **v2.0.0** - Database integration with PostgreSQL
- **v1.5.0** - Enhanced admin dashboard and email notifications
- **v1.0.0** - Initial release with JSON file storage

---

**EcoSpin Laundry Management System** 