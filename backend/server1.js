import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import cron from 'node-cron';

// Import routes and services
import stkPushRoute from './routes/stkpush.js';
import ordersRoute from './routes/orders.js';
import { sendDailyReport } from './services/report.js';

// Setup __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files (your frontend)
app.use(express.static(path.join(__dirname, 'public')));

// API Routes
app.use('/api', stkPushRoute);
app.use('/api', ordersRoute);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'EcoSpin Backend is running!' });
});

// Serve frontend for all other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Schedule daily report at midnight
cron.schedule('0 0 * * *', async () => {
  console.log('📧 Sending daily report...');
  try {
    await sendDailyReport();
    console.log('✅ Daily report sent successfully');
  } catch (error) {
    console.error('❌ Failed to send daily report:', error);
  }
});

// Create reports directory if it doesn't exist
import fs from 'fs';
const reportsDir = path.join(__dirname, 'reports');
if (!fs.existsSync(reportsDir)) {
  fs.mkdirSync(reportsDir);
}

app.listen(PORT, () => {
  console.log(`🚀 EcoSpin Backend running on port ${PORT}`);
  console.log(`📊 Reports will be saved to: ${reportsDir}`);
});