const express = require('express');
const cors = require('cors');
const path = require('path');
const nodemailer = require('nodemailer');
const { Pool } = require('pg');
const { basicAuth } = require('./middleware/basicAuth');

require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Database connection
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Test database connection
async function testDatabaseConnection() {
    try {
        const client = await pool.connect();
        const result = await client.query('SELECT NOW()');
        client.release();
        console.log('✅ Database connected successfully');
        return true;
    } catch (error) {
        console.error('❌ Database connection failed:', error.message);
        return false;
    }
}

// Initialize database tables
async function initializeDatabase() {
    try {
        // Create orders table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS orders (
                id VARCHAR(50) PRIMARY KEY,
                service VARCHAR(255) NOT NULL,
                price INTEGER NOT NULL,
                customer_name VARCHAR(255) NOT NULL,
                customer_phone VARCHAR(50) NOT NULL,
                address TEXT NOT NULL,
                notes TEXT DEFAULT '',
                status VARCHAR(50) DEFAULT 'pending_payment',
                payment_method VARCHAR(50) DEFAULT 'manual_mpesa',
                mpesa_code VARCHAR(100),
                admin_notes TEXT DEFAULT '',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                paid_at TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                pickup_scheduled BOOLEAN DEFAULT FALSE,
                pickup_date TIMESTAMP,
                delivery_date TIMESTAMP
            )
        `);
        
        // Create counters table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS counters (
                name VARCHAR(50) PRIMARY KEY,
                value INTEGER NOT NULL DEFAULT 1
            )
        `);
        
        // Initialize counter if not exists
        await pool.query(`
            INSERT INTO counters (name, value) 
            VALUES ('order_counter', 1) 
            ON CONFLICT (name) DO NOTHING
        `);
        
        // Create indexes for better performance
        await pool.query(`
            CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);
        `);
        
        await pool.query(`
            CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
        `);
        
        console.log('✅ Database tables initialized');
    } catch (error) {
        console.error('❌ Database initialization failed:', error);
        throw error;
    }
}

// Middleware
const corsOptions = {
    origin: [
        "http://localhost:3000",
        "http://127.0.0.1:5500",
        "https://ecospin-laundrychuka.netlify.app",
        "https://yourcustomdomain.com"
    ],
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
};

app.use(cors(corsOptions));
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// Email Configuration
const emailConfig = {
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
};

// Create transporter
let transporter;
try {
    if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
        transporter = nodemailer.createTransporter(emailConfig);
        transporter.verify((error, success) => {
            if (error) {
                console.warn('⚠️  Email configuration error:', error.message);
                transporter = null;
            } else {
                console.log('📧 Email server ready');
            }
        });
    } else {
        console.warn('⚠️  Email not configured. Set EMAIL_USER and EMAIL_PASS in .env file');
    }
} catch (error) {
    console.warn('⚠️  Email transporter creation failed:', error.message);
}

// Configuration
const BUSINESS_NUMBER = process.env.BUSINESS_NUMBER;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const BUSINESS_NAME = 'EcoSpin Laundry';

// In-memory storage for caching (loaded from database)
let orders = new Map();

// Database helper functions
async function getNextOrderId() {
    try {
        const result = await pool.query(
            'UPDATE counters SET value = value + 1 WHERE name = $1 RETURNING value',
            ['order_counter']
        );
        const counter = result.rows[0].value;
        return `ECOSPIN-${String(counter).padStart(4, '0')}`;
    } catch (error) {
        console.error('❌ Error getting order ID:', error);
        throw error;
    }
}

async function saveOrderToDatabase(order) {
    try {
        await pool.query(`
            INSERT INTO orders (
                id, service, price, customer_name, customer_phone, address, notes,
                status, payment_method, mpesa_code, admin_notes, created_at, paid_at,
                updated_at, pickup_scheduled, pickup_date, delivery_date
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
            ON CONFLICT (id) DO UPDATE SET
                service = EXCLUDED.service,
                price = EXCLUDED.price,
                customer_name = EXCLUDED.customer_name,
                customer_phone = EXCLUDED.customer_phone,
                address = EXCLUDED.address,
                notes = EXCLUDED.notes,
                status = EXCLUDED.status,
                payment_method = EXCLUDED.payment_method,
                mpesa_code = EXCLUDED.mpesa_code,
                admin_notes = EXCLUDED.admin_notes,
                paid_at = EXCLUDED.paid_at,
                updated_at = EXCLUDED.updated_at,
                pickup_scheduled = EXCLUDED.pickup_scheduled,
                pickup_date = EXCLUDED.pickup_date,
                delivery_date = EXCLUDED.delivery_date
        `, [
            order.id, order.service, order.price, order.customerName, order.customerPhone,
            order.address, order.notes || '', order.status, order.paymentMethod || 'manual_mpesa',
            order.mpesaCode || null, order.adminNotes || '', order.createdAt, order.paidAt,
            order.updatedAt, order.pickupScheduled || false, order.pickupDate || null,
            order.deliveryDate || null
        ]);
        
        // Update in-memory cache
        orders.set(order.id, order);
        
        console.log(`💾 Order saved to database: ${order.id}`);
    } catch (error) {
        console.error('❌ Error saving order to database:', error);
        throw error;
    }
}

async function loadOrdersFromDatabase() {
    try {
        const result = await pool.query('SELECT * FROM orders ORDER BY created_at DESC');
        orders.clear();
        
        for (const row of result.rows) {
            const order = {
                id: row.id,
                service: row.service,
                price: row.price,
                customerName: row.customer_name,
                customerPhone: row.customer_phone,
                address: row.address,
                notes: row.notes || '',
                status: row.status,
                paymentMethod: row.payment_method,
                mpesaCode: row.mpesa_code,
                adminNotes: row.admin_notes || '',
                createdAt: row.created_at,
                paidAt: row.paid_at,
                updatedAt: row.updated_at,
                pickupScheduled: row.pickup_scheduled,
                pickupDate: row.pickup_date,
                deliveryDate: row.delivery_date,
                mpesaInstructions: {
                    amount: row.price,
                    phoneNumber: BUSINESS_NUMBER,
                    reference: row.id
                }
            };
            orders.set(row.id, order);
        }
        
        console.log(`📦 Loaded ${orders.size} orders from database`);
    } catch (error) {
        console.error('❌ Error loading orders from database:', error);
    }
}

async function deleteOrderFromDatabase(orderId) {
    try {
        await pool.query('DELETE FROM orders WHERE id = $1', [orderId]);
        orders.delete(orderId);
        console.log(`🗑️ Order deleted from database: ${orderId}`);
    } catch (error) {
        console.error('❌ Error deleting order from database:', error);
        throw error;
    }
}

// Email Templates
const emailTemplates = {
    newOrderAdmin: (order) => ({
        subject: `🔔 New Order #${order.id} - ${BUSINESS_NAME}`,
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #f8f9fa;">
                <div style="background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
                    <h2 style="color: #0077cc; text-align: center; margin-bottom: 30px;">
                        🧺 New Order Received!
                    </h2>
                    
                    <div style="background: #e3f2fd; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                        <h3 style="color: #1976d2; margin: 0 0 15px 0;">Order Details</h3>
                        <table style="width: 100%; border-collapse: collapse;">
                            <tr>
                                <td style="padding: 8px 0; font-weight: bold; color: #555;">Order ID:</td>
                                <td style="padding: 8px 0; color: #333;">${order.id}</td>
                            </tr>
                            <tr>
                                <td style="padding: 8px 0; font-weight: bold; color: #555;">Service:</td>
                                <td style="padding: 8px 0; color: #333;">${order.service}</td>
                            </tr>
                            <tr>
                                <td style="padding: 8px 0; font-weight: bold; color: #555;">Amount:</td>
                                <td style="padding: 8px 0; color: #333; font-weight: bold;">KSH ${order.price}</td>
                            </tr>
                            <tr>
                                <td style="padding: 8px 0; font-weight: bold; color: #555;">Status:</td>
                                <td style="padding: 8px 0;">
                                    <span style="background: #fff3cd; color: #856404; padding: 4px 12px; border-radius: 20px; font-size: 12px;">
                                        ${order.status.toUpperCase()}
                                    </span>
                                </td>
                            </tr>
                        </table>
                    </div>

                    <div style="background: #f1f8ff; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                        <h3 style="color: #1976d2; margin: 0 0 15px 0;">Customer Information</h3>
                        <table style="width: 100%; border-collapse: collapse;">
                            <tr>
                                <td style="padding: 8px 0; font-weight: bold; color: #555;">Name:</td>
                                <td style="padding: 8px 0; color: #333;">${order.customerName}</td>
                            </tr>
                            <tr>
                                <td style="padding: 8px 0; font-weight: bold; color: #555;">Phone:</td>
                                <td style="padding: 8px 0; color: #333;">
                                    <a href="tel:${order.customerPhone}" style="color: #0077cc; text-decoration: none;">
                                        ${order.customerPhone}
                                    </a>
                                </td>
                            </tr>
                            <tr>
                                <td style="padding: 8px 0; font-weight: bold; color: #555; vertical-align: top;">Address:</td>
                                <td style="padding: 8px 0; color: #333;">${order.address}</td>
                            </tr>
                            ${order.notes ? `
                            <tr>
                                <td style="padding: 8px 0; font-weight: bold; color: #555; vertical-align: top;">Notes:</td>
                                <td style="padding: 8px 0; color: #333; font-style: italic;">${order.notes}</td>
                            </tr>
                            ` : ''}
                        </table>
                    </div>

                    <div style="background: #e8f5e8; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                        <h3 style="color: #2e7d32; margin: 0 0 15px 0;">Payment Instructions</h3>
                        <ul style="color: #333; margin: 10px 0;">
                            <li><strong>Phone:</strong> ${order.mpesaInstructions.phoneNumber}</li>
                            <li><strong>Amount:</strong> KSH ${order.mpesaInstructions.amount}</li>
                            <li><strong>Reference:</strong> ${order.mpesaInstructions.reference}</li>
                        </ul>
                    </div>

                    <div style="text-align: center; color: #777; font-size: 12px;">
                        <p>Order created at: ${new Date(order.createdAt).toLocaleString()}</p>
                        <p style="margin: 5px 0 0 0;">© 2025 ${BUSINESS_NAME} - Clean Clothes, Cleaner Planet</p>
                    </div>
                </div>
            </div>
        `
    }),

    paymentConfirmed: (order) => ({
        subject: `✅ Payment Confirmed - Order #${order.id}`,
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #f8f9fa;">
                <div style="background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
                    <div style="text-align: center; margin-bottom: 30px;">
                        <h2 style="color: #28a745; margin-bottom: 10px;">🎉 Payment Confirmed!</h2>
                        <p style="color: #666; font-size: 16px; margin: 0;">Thank you for choosing ${BUSINESS_NAME}</p>
                    </div>
                    
                    <div style="background: #d4edda; border: 1px solid #c3e6cb; padding: 20px; border-radius: 8px; margin-bottom: 25px;">
                        <h3 style="color: #155724; margin: 0 0 15px 0; text-align: center;">Order Confirmed & Processing</h3>
                        <table style="width: 100%; border-collapse: collapse;">
                            <tr>
                                <td style="padding: 8px 0; font-weight: bold; color: #155724;">Order ID:</td>
                                <td style="padding: 8px 0; color: #155724;">${order.id}</td>
                            </tr>
                            <tr>
                                <td style="padding: 8px 0; font-weight: bold; color: #155724;">Service:</td>
                                <td style="padding: 8px 0; color: #155724;">${order.service}</td>
                            </tr>
                            <tr>
                                <td style="padding: 8px 0; font-weight: bold; color: #155724;">Amount Paid:</td>
                                <td style="padding: 8px 0; color: #155724; font-weight: bold;">KSH ${order.price}</td>
                            </tr>
                            <tr>
                                <td style="padding: 8px 0; font-weight: bold; color: #155724;">Payment Time:</td>
                                <td style="padding: 8px 0; color: #155724;">${new Date(order.paidAt).toLocaleString()}</td>
                            </tr>
                        </table>
                    </div>

                    <div style="text-align: center; color: #777; font-size: 12px;">
                        <p>Thank you for choosing ${BUSINESS_NAME}!</p>
                        <p style="margin: 5px 0 0 0;">Clean Clothes, Cleaner Planet 🌱</p>
                    </div>
                </div>
            </div>
        `
    }),

    orderStatusUpdate: (order, oldStatus) => ({
        subject: `📋 Order Update - ${order.id} - ${order.status.replace('_', ' ').toUpperCase()}`,
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #f8f9fa;">
                <div style="background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
                    <div style="text-align: center; margin-bottom: 30px;">
                        <h2 style="color: #0077cc; margin-bottom: 10px;">📋 Order Status Update</h2>
                        <p style="color: #666; font-size: 16px; margin: 0;">Hello ${order.customerName}</p>
                    </div>
                    
                    <div style="background: #e3f2fd; padding: 20px; border-radius: 8px; margin-bottom: 25px;">
                        <h3 style="color: #1976d2; margin: 0 0 15px 0; text-align: center;">Your Order #${order.id}</h3>
                        <table style="width: 100%; border-collapse: collapse;">
                            <tr>
                                <td style="padding: 8px 0; font-weight: bold; color: #555;">Service:</td>
                                <td style="padding: 8px 0; color: #333;">${order.service}</td>
                            </tr>
                            <tr>
                                <td style="padding: 8px 0; font-weight: bold; color: #555;">Previous Status:</td>
                                <td style="padding: 8px 0; color: #666;">${oldStatus.replace('_', ' ').toUpperCase()}</td>
                            </tr>
                            <tr>
                                <td style="padding: 8px 0; font-weight: bold; color: #555;">New Status:</td>
                                <td style="padding: 8px 0;">
                                    <span style="background: #d4edda; color: #155724; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: bold;">
                                        ${order.status.replace('_', ' ').toUpperCase()}
                                    </span>
                                </td>
                            </tr>
                        </table>
                    </div>

                    <div style="text-align: center; color: #777; font-size: 12px;">
                        <p>Thank you for choosing ${BUSINESS_NAME}!</p>
                        <p style="margin: 5px 0 0 0;">Clean Clothes, Cleaner Planet 🌱</p>
                    </div>
                </div>
            </div>
        `
    })
};

// Email sending function
async function sendEmail(to, template) {
    if (!transporter) {
        console.warn('⚠️  Email not configured - skipping email send');
        return false;
    }

    try {
        const info = await transporter.sendMail({
            from: `"${BUSINESS_NAME}" <${process.env.EMAIL_USER}>`,
            to: to,
            subject: template.subject,
            html: template.html
        });

        console.log(`📧 Email sent to ${to}: ${template.subject}`);
        return true;
    } catch (error) {
        console.error('❌ Email send failed:', error.message);
        return false;
    }
}

// API Routes

// Get main website
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Protect everything under /admin
app.use("/admin", basicAuth, express.static(path.join(__dirname, "admin")));

// Serve customer-facing public site (open)
app.use(express.static(path.join(__dirname, "public")));

// Create manual payment order
app.post('/api/create-order', async (req, res) => {
    try {
        const { service, price, name, phone, address, notes } = req.body;
        
        // Validate required fields
        if (!service || !price || !name || !phone || !address) {
            return res.status(400).json({ 
                success: false, 
                message: 'Missing required fields' 
            });
        }
        
        // Generate order ID from database
        const orderId = await getNextOrderId();
        
        // Create order with full details
        const order = {
            id: orderId,
            service,
            price: parseInt(price),
            customerName: name,
            customerPhone: phone,
            address,
            notes: notes || '',
            status: 'pending_payment',
            paymentMethod: 'manual_mpesa',
            createdAt: new Date(),
            paidAt: null,
            updatedAt: new Date(),
            mpesaInstructions: {
                amount: parseInt(price),
                phoneNumber: BUSINESS_NUMBER,
                reference: orderId
            },
            pickupScheduled: false,
            pickupDate: null,
            deliveryDate: null,
            adminNotes: ''
        };
        
        // Save to database
        await saveOrderToDatabase(order);
        
        console.log(`📦 New order created: ${orderId} for ${name} - ${service} (KSH ${price})`);
        
        // Send email notification to admin
        if (ADMIN_EMAIL) {
            await sendEmail(ADMIN_EMAIL, emailTemplates.newOrderAdmin(order));
        }
        
        res.json({
            success: true,
            message: 'Order created successfully',
            order: {
                id: orderId,
                service,
                price: parseInt(price),
                status: 'pending_payment',
                createdAt: order.createdAt,
                mpesaInstructions: {
                    amount: parseInt(price),
                    phoneNumber: BUSINESS_NUMBER,
                    reference: orderId
                }
            }
        });
        
    } catch (error) {
        console.error('❌ Order creation error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to create order'
        });
    }
});

// Mark order as paid (for manual confirmation)
app.post('/api/confirm-payment/:orderId', async (req, res) => {
    try {
        const { orderId } = req.params;
        const { mpesaCode } = req.body;

        const order = orders.get(orderId);
        
        if (!order) {
            return res.status(404).json({ 
                success: false, 
                message: 'Order not found' 
            });
        }
        
        if (order.status === 'paid') {
            return res.status(400).json({ 
                success: false, 
                message: 'Order is already marked as paid' 
            });
        }
        
        // Update order status and details
        order.status = 'paid';
        order.paidAt = new Date();
        order.updatedAt = new Date();
        if (mpesaCode) order.mpesaCode = mpesaCode;

        // Save to database
        await saveOrderToDatabase(order);
        
        console.log(`✅ Payment confirmed for order: ${orderId} - ${order.customerName}, Ref: ${mpesaCode || 'N/A'}`);
        
        // Send confirmation email to admin
        if (ADMIN_EMAIL) {
            await sendEmail(ADMIN_EMAIL, emailTemplates.paymentConfirmed(order));
        }
        
        res.json({ 
            success: true, 
            message: 'Payment confirmed successfully',
            order 
        });
        
    } catch (error) {
        console.error('❌ Payment confirmation error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to confirm payment'
        });
    }
});

// Get order status
app.get('/api/order/:orderId', (req, res) => {
    const { orderId } = req.params;
    const order = orders.get(orderId);
    
    if (!order) {
        return res.status(404).json({ 
            success: false, 
            message: 'Order not found' 
        });
    }
    
    res.json({ success: true, order });
});

// API endpoint for orders (JSON) - Used by admin dashboard
app.get('/api/orders', (req, res) => {
    const allOrders = Array.from(orders.values())
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    const summary = {
        total: allOrders.length,
        pending: allOrders.filter(o => o.status === 'pending_payment').length,
        paid: allOrders.filter(o => o.status === 'paid').length,
        in_progress: allOrders.filter(o => ['pickup_scheduled', 'picked_up', 'in_progress'].includes(o.status)).length,
        completed: allOrders.filter(o => ['delivered'].includes(o.status)).length,
        totalRevenue: allOrders.filter(o => o.status === 'paid' || o.status === 'delivered').reduce((sum, order) => sum + order.price, 0),
        pendingRevenue: allOrders.filter(o => o.status === 'pending_payment').reduce((sum, order) => sum + order.price, 0)
    };
    
    res.json({ 
        success: true, 
        orders: allOrders,
        summary
    });
});

// Update order status
app.put('/api/order/:orderId/status', async (req, res) => {
    try {
        const { orderId } = req.params;
        const { status, adminNotes, notifyCustomer } = req.body;
        const order = orders.get(orderId);
        
        if (!order) {
            return res.status(404).json({ 
                success: false, 
                message: 'Order not found' 
            });
        }
        
        const allowedStatuses = ['pending_payment', 'paid', 'pickup_scheduled', 'picked_up', 'in_progress', 'ready_for_delivery', 'delivered'];
        
        if (!allowedStatuses.includes(status)) {
            return res.status(400).json({ 
                success: false, 
                message: 'Invalid status' 
            });
        }
        
        const oldStatus = order.status;
        order.status = status;
        if (adminNotes) order.adminNotes = adminNotes;
        order.updatedAt = new Date();
        
        // Special handling for paid status
        if (status === 'paid' && oldStatus !== 'paid') {
            order.paidAt = new Date();
        }
        
        // Save to database
        await saveOrderToDatabase(order);
        
        console.log(`📝 Order ${orderId} status updated from ${oldStatus} to: ${status}`);
        
        // Send customer notification if requested
        if (notifyCustomer && oldStatus !== status && ADMIN_EMAIL) {
            await sendEmail(ADMIN_EMAIL, emailTemplates.orderStatusUpdate(order, oldStatus));
        }
        
        res.json({ 
            success: true, 
            message: 'Order status updated',
            order 
        });
        
    } catch (error) {
        console.error('❌ Status update error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to update order status'
        });
    }
});

// Delete order (admin only - for mistakes)
app.delete('/api/order/:orderId', async (req, res) => {
    try {
        const { orderId } = req.params;
        
        if (orders.has(orderId)) {
            const deletedOrder = orders.get(orderId);
            await deleteOrderFromDatabase(orderId);
            
            console.log(`🗑️ Order deleted: ${orderId} - ${deletedOrder.customerName}`);
            
            res.json({ 
                success: true, 
                message: 'Order deleted successfully' 
            });
        } else {
            res.status(404).json({ 
                success: false, 
                message: 'Order not found' 
            });
        }
        
    } catch (error) {
        console.error('❌ Delete order error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to delete order'
        });
    }
});

// Health check with database status
app.get('/api/health', async (req, res) => {
    const allOrders = Array.from(orders.values());
    const summary = {
        total: allOrders.length,
        pending: allOrders.filter(o => o.status === 'pending_payment').length,
        paid: allOrders.filter(o => o.status === 'paid').length,
        in_progress: allOrders.filter(o => ['pickup_scheduled', 'picked_up', 'in_progress'].includes(o.status)).length,
        completed: allOrders.filter(o => ['delivered'].includes(o.status)).length
    };

    // Test database connection
    const dbConnected = await testDatabaseConnection();
    
    res.json({ 
        status: 'OK', 
        timestamp: new Date(),
        orders_summary: summary,
        mode: 'database_persistence',
        business_number: BUSINESS_NUMBER,
        email_configured: !!transporter,
        database_connected: dbConnected,
        persistence: 'PostgreSQL Database'
    });
});

// Export orders to CSV
app.get('/api/export/csv', (req, res) => {
    const allOrders = Array.from(orders.values())
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    const csvHeader = 'Order ID,Customer Name,Phone,Service,Amount,Status,Address,Notes,Admin Notes,M-Pesa Code,Created At,Paid At,Updated At\n';
    const csvData = allOrders.map(order => [
        order.id,
        `"${order.customerName}"`,
        order.customerPhone,
        `"${order.service}"`,
        order.price,
        order.status,
        `"${order.address}"`,
        `"${order.notes || ''}"`,
        `"${order.adminNotes || ''}"`,
        `"${order.mpesaCode || ''}"`,
        order.createdAt.toISOString(),
        order.paidAt ? order.paidAt.toISOString() : '',
        order.updatedAt ? order.updatedAt.toISOString() : ''
    ].join(',')).join('\n');
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="ecospin_orders_${new Date().toISOString().split('T')[0]}.csv"`);
    res.send(csvHeader + csvData);
});

// Backup endpoint - creates a JSON backup of all data
app.get('/api/backup', async (req, res) => {
    try {
        const counterResult = await pool.query('SELECT value FROM counters WHERE name = $1', ['order_counter']);
        const currentCounter = counterResult.rows[0]?.value || 1;

        const backup = {
            timestamp: new Date(),
            counter: currentCounter,
            orders: Object.fromEntries(orders),
            version: '2.0',
            source: 'database'
        };
        
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="ecospin_backup_${new Date().toISOString().split('T')[0]}.json"`);
        res.json(backup);
    } catch (error) {
        console.error('❌ Backup error:', error);
        res.status(500).json({ success: false, message: 'Backup failed' });
    }
});

// Database management endpoints
app.get('/api/db/status', async (req, res) => {
    try {
        const client = await pool.connect();
        
        // Get database stats
        const orderCount = await client.query('SELECT COUNT(*) FROM orders');
        const counterValue = await client.query('SELECT value FROM counters WHERE name = $1', ['order_counter']);
        const recentOrders = await client.query('SELECT created_at FROM orders ORDER BY created_at DESC LIMIT 1');
        const statusCounts = await client.query(`
            SELECT status, COUNT(*) as count 
            FROM orders 
            GROUP BY status
        `);
        
        client.release();
        
        const statusBreakdown = {};
        statusCounts.rows.forEach(row => {
            statusBreakdown[row.status] = parseInt(row.count);
        });
        
        res.json({
            success: true,
            database: {
                connected: true,
                total_orders: parseInt(orderCount.rows[0].count),
                counter_value: counterValue.rows[0]?.value || 1,
                last_order: recentOrders.rows[0]?.created_at || null,
                cache_size: orders.size,
                status_breakdown: statusBreakdown
            }
        });
    } catch (error) {
        console.error('❌ Database status error:', error);
        res.status(500).json({
            success: false,
            database: {
                connected: false,
                error: error.message
            }
        });
    }
});

// Refresh cache from database
app.post('/api/db/refresh-cache', async (req, res) => {
    try {
        await loadOrdersFromDatabase();
        res.json({ 
            success: true, 
            message: `Cache refreshed with ${orders.size} orders`,
            orders_loaded: orders.size 
        });
    } catch (error) {
        console.error('❌ Cache refresh error:', error);
        res.status(500).json({ success: false, message: 'Failed to refresh cache' });
    }
});

// Get database statistics
app.get('/api/db/stats', async (req, res) => {
    try {
        const client = await pool.connect();
        
        // Revenue statistics
        const revenueStats = await client.query(`
            SELECT 
                SUM(CASE WHEN status IN ('paid', 'delivered') THEN price ELSE 0 END) as total_revenue,
                SUM(CASE WHEN status = 'pending_payment' THEN price ELSE 0 END) as pending_revenue,
                COUNT(CASE WHEN status IN ('paid', 'delivered') THEN 1 END) as paid_orders,
                COUNT(CASE WHEN status = 'pending_payment' THEN 1 END) as pending_orders,
                AVG(price) as average_order_value
            FROM orders
        `);
        
        // Monthly statistics
        const monthlyStats = await client.query(`
            SELECT 
                DATE_TRUNC('month', created_at) as month,
                COUNT(*) as orders,
                SUM(CASE WHEN status IN ('paid', 'delivered') THEN price ELSE 0 END) as revenue
            FROM orders
            WHERE created_at >= NOW() - INTERVAL '12 months'
            GROUP BY DATE_TRUNC('month', created_at)
            ORDER BY month DESC
        `);
        
        client.release();
        
        res.json({
            success: true,
            stats: {
                revenue: revenueStats.rows[0],
                monthly: monthlyStats.rows
            }
        });
    } catch (error) {
        console.error('❌ Stats error:', error);
        res.status(500).json({ success: false, message: 'Failed to get statistics' });
    }
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('❌ Server Error:', err.stack);
    res.status(500).json({ 
        success: false, 
        message: 'Something went wrong!' 
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ 
        success: false, 
        message: 'Endpoint not found' 
    });
});

// Graceful shutdown handler
process.on('SIGINT', async () => {
    console.log('\n🛑 Shutting down server...');
    try {
        await pool.end();
        console.log('💾 Database connections closed');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error during shutdown:', error);
        process.exit(1);
    }
});

process.on('SIGTERM', async () => {
    console.log('\n🛑 Received SIGTERM, shutting down gracefully...');
    try {
        await pool.end();
        console.log('💾 Database connections closed');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error during shutdown:', error);
        process.exit(1);
    }
});

// Initialize server
async function startServer() {
    try {
        // Test database connection first
        const dbConnected = await testDatabaseConnection();
        if (!dbConnected) {
            throw new Error('Database connection failed');
        }
        
        // Initialize database tables
        await initializeDatabase();
        
        // Load existing data from database
        await loadOrdersFromDatabase();
        
        // Start server
        app.listen(PORT, () => {
            console.log(`🚀 EcoSpin Laundry server running on port ${PORT}`);
            console.log(`💳 Payment Mode: Manual M-Pesa`);
            console.log(`📱 Business Number: ${BUSINESS_NUMBER}`);
            console.log(`📊 Admin Dashboard: http://localhost:${PORT}/admin/`);
            console.log(`🌐 Website: http://localhost:${PORT}`);
            console.log(`📧 Email notifications: ${transporter ? '✅ Configured' : '❌ Not configured'}`);
            console.log(`💾 Database: PostgreSQL (Persistent)`);
            console.log(`📈 API Health Check: http://localhost:${PORT}/api/health`);
            console.log(`🗄️ Database Status: http://localhost:${PORT}/api/db/status`);
            console.log(`📊 Database Stats: http://localhost:${PORT}/api/db/stats`);
            console.log(`🔄 Refresh Cache: POST http://localhost:${PORT}/api/db/refresh-cache`);
            console.log(`📁 Export Orders: http://localhost:${PORT}/api/export/csv`);
            console.log(`💾 Backup Data: http://localhost:${PORT}/api/backup`);
            console.log(`📦 Loaded ${orders.size} existing orders from database`);
        });
        
        // Refresh cache every 10 minutes to stay in sync with database
        setInterval(async () => {
            try {
                await loadOrdersFromDatabase();
                console.log('🔄 Cache refreshed from database');
            } catch (error) {
                console.error('❌ Cache refresh failed:', error);
            }
        }, 10 * 60 * 1000);
        
    } catch (error) {
        console.error('❌ Server startup failed:', error);
        process.exit(1);
    }
}

// Start the server
startServer();