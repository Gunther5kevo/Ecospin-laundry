const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs').promises;
const nodemailer = require('nodemailer');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// File paths for persistence
const ORDERS_FILE = path.join(__dirname, 'data', 'orders.json');
const COUNTER_FILE = path.join(__dirname, 'data', 'counter.json');

// Middleware
const corsOptions = {
  origin: [
    "http://localhost:3000",   // for local dev (Vite/React default)
    "https://yourfrontend.netlify.app", // Netlify frontend
    "https://yourcustomdomain.com" // If you attach a real domain
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
        transporter = nodemailer.createTransport(emailConfig);
        // Test the connection
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
const BUSINESS_NUMBER = process.env.BUSINESS_NUMBER ;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const BUSINESS_NAME = 'EcoSpin Laundry';

// In-memory storage for orders (loaded from JSON)
let orders = new Map();
let orderCounter = 1;

// Data persistence functions
async function ensureDataDirectory() {
    const dataDir = path.join(__dirname, 'data');
    try {
        await fs.access(dataDir);
    } catch (error) {
        await fs.mkdir(dataDir, { recursive: true });
        console.log('📁 Created data directory');
    }
}

async function loadOrders() {
    try {
        await ensureDataDirectory();
        const ordersData = await fs.readFile(ORDERS_FILE, 'utf8');
        const parsedOrders = JSON.parse(ordersData);
        
        orders = new Map();
        for (const [key, value] of Object.entries(parsedOrders)) {
            // Convert date strings back to Date objects
            if (value.createdAt) value.createdAt = new Date(value.createdAt);
            if (value.paidAt) value.paidAt = new Date(value.paidAt);
            if (value.updatedAt) value.updatedAt = new Date(value.updatedAt);
            orders.set(key, value);
        }
        
        console.log(`📦 Loaded ${orders.size} orders from storage`);
    } catch (error) {
        if (error.code === 'ENOENT') {
            console.log('📝 No existing orders file found, starting fresh');
        } else {
            console.error('❌ Error loading orders:', error.message);
        }
    }
}

async function loadCounter() {
    try {
        const counterData = await fs.readFile(COUNTER_FILE, 'utf8');
        const parsed = JSON.parse(counterData);
        orderCounter = parsed.counter || 1;
        console.log(`🔢 Loaded order counter: ${orderCounter}`);
    } catch (error) {
        if (error.code === 'ENOENT') {
            console.log('🔢 No existing counter file found, starting at 1');
        } else {
            console.error('❌ Error loading counter:', error.message);
        }
    }
}

async function saveOrders() {
    try {
        await ensureDataDirectory();
        const ordersObject = Object.fromEntries(orders);
        await fs.writeFile(ORDERS_FILE, JSON.stringify(ordersObject, null, 2));
    } catch (error) {
        console.error('❌ Error saving orders:', error.message);
    }
}

async function saveCounter() {
    try {
        await ensureDataDirectory();
        await fs.writeFile(COUNTER_FILE, JSON.stringify({ counter: orderCounter }, null, 2));
    } catch (error) {
        console.error('❌ Error saving counter:', error.message);
    }
}

// Auto-save function
async function autoSave() {
    await Promise.all([saveOrders(), saveCounter()]);
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
                        <h3 style="color: #2e7d32; margin: 0 0 15px 0;">Payment Instructions (For Customer)</h3>
                        <p style="margin: 0 0 10px 0; color: #555;">Customer should send payment to:</p>
                        <ul style="color: #333; margin: 10px 0;">
                            <li><strong>Phone:</strong> ${order.mpesaInstructions.phoneNumber}</li>
                            <li><strong>Amount:</strong> KSH ${order.mpesaInstructions.amount}</li>
                            <li><strong>Reference:</strong> ${order.mpesaInstructions.reference}</li>
                        </ul>
                    </div>

                    <div style="text-align: center; margin: 30px 0;">
                        <a href="http://localhost:${PORT}/admin.html" 
                           style="background: #0077cc; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
                            📊 View Admin Dashboard
                        </a>
                    </div>

                    <div style="background: #fff3cd; padding: 15px; border-radius: 8px; margin-top: 20px;">
                        <p style="margin: 0; color: #856404; font-size: 14px; text-align: center;">
                            <strong>⏰ Next Steps:</strong> Wait for M-Pesa payment confirmation, then update order status to "Paid"
                        </p>
                    </div>

                    <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
                    
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
                            <tr>
                                <td style="padding: 8px 0; font-weight: bold; color: #555;">Updated:</td>
                                <td style="padding: 8px 0; color: #333;">${new Date(order.updatedAt).toLocaleString()}</td>
                            </tr>
                        </table>
                    </div>

                    ${order.adminNotes ? `
                    <div style="background: #fff3cd; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                        <h4 style="color: #856404; margin: 0 0 10px 0;">📝 Note from ${BUSINESS_NAME}:</h4>
                        <p style="margin: 0; color: #856404; font-style: italic;">${order.adminNotes}</p>
                    </div>
                    ` : ''}

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

// Get admin dashboard
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/admin.html'));
});


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
        
        // Generate order ID
        const orderId = `ECOSPIN-${String(orderCounter).padStart(4, '0')}`;
        orderCounter++;
        
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
            // Additional tracking fields
            pickupScheduled: false,
            pickupDate: null,
            deliveryDate: null,
            adminNotes: ''
        };
        
        // Store order
        orders.set(orderId, order);
        
        // Auto-save to JSON
        await autoSave();
        
        console.log(`📦 New order created: ${orderId} for ${name} - ${service} (KSH ${price})`);
        
        // Send email notification to admin
        await sendEmail(ADMIN_EMAIL, emailTemplates.newOrderAdmin(order));
        
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
        const { mpesaCode } = req.body; // 🔑 capture M-Pesa code from frontend

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
        
        // ✅ Update order status and details
        order.status = 'paid';
        order.paidAt = new Date();
        order.updatedAt = new Date();
        if (mpesaCode) order.mpesaCode = mpesaCode; // store M-Pesa reference

        orders.set(orderId, order);
        
        // Save changes to JSON
        await autoSave();
        
        console.log(`✅ Payment confirmed for order: ${orderId} - ${order.customerName}, Ref: ${mpesaCode || 'N/A'}`);
        
        // Send confirmation email to admin
        await sendEmail(ADMIN_EMAIL, emailTemplates.paymentConfirmed(order));
        
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

// Update order status (for additional status tracking)
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
        
        orders.set(orderId, order);
        
        // Auto-save to JSON
        await autoSave();
        
        console.log(`📝 Order ${orderId} status updated from ${oldStatus} to: ${status}`);
        
        // Send customer notification if requested and we have their phone/email info
        if (notifyCustomer && oldStatus !== status) {
            // For now, we'll just send to admin as a notification that customer should be notified
            // In a real implementation, you might have customer email or use SMS
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
            orders.delete(orderId);
            
            // Auto-save to JSON
            await autoSave();
            
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

// Health check with more details
app.get('/api/health', (req, res) => {
    const allOrders = Array.from(orders.values());
    const summary = {
        total: allOrders.length,
        pending: allOrders.filter(o => o.status === 'pending_payment').length,
        paid: allOrders.filter(o => o.status === 'paid').length,
        in_progress: allOrders.filter(o => ['pickup_scheduled', 'picked_up', 'in_progress'].includes(o.status)).length,
        completed: allOrders.filter(o => ['delivered'].includes(o.status)).length
    };
    
    res.json({ 
        status: 'OK', 
        timestamp: new Date(),
        orders_summary: summary,
        mode: 'manual_payments',
        business_number: BUSINESS_NUMBER,
        email_configured: !!transporter,
        persistence: 'JSON file storage',
        data_directory: path.join(__dirname, 'data')
    });
});

// Export orders to CSV (bonus feature)
app.get('/api/export/csv', (req, res) => {
    const allOrders = Array.from(orders.values())
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    const csvHeader = 'Order ID,Customer Name,Phone,Service,Amount,Status,Address,Notes,Admin Notes,Created At,Paid At,Updated At\n';
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
        order.createdAt.toISOString(),
        order.paidAt ? order.paidAt.toISOString() : '',
        order.updatedAt ? order.updatedAt.toISOString() : ''
    ].join(',')).join('\n');
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="ecospin_orders_${new Date().toISOString().split('T')[0]}.csv"`);
    res.send(csvHeader + csvData);
});

// Backup endpoint - creates a JSON backup of all data
app.get('/api/backup', (req, res) => {
    const backup = {
        timestamp: new Date(),
        counter: orderCounter,
        orders: Object.fromEntries(orders),
        version: '1.0'
    };
    
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="ecospin_backup_${new Date().toISOString().split('T')[0]}.json"`);
    res.json(backup);
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
        await autoSave();
        console.log('💾 Data saved successfully');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error saving data during shutdown:', error);
        process.exit(1);
    }
});

// Initialize server
async function startServer() {
    try {
        // Load existing data
        await Promise.all([loadOrders(), loadCounter()]);
        
        // Start server
        app.listen(PORT, () => {
            console.log(`🚀 EcoSpin Laundry server running on port ${PORT}`);
            console.log(`💳 Payment Mode: Manual M-Pesa`);
            console.log(`📱 Business Number: ${BUSINESS_NUMBER}`);
            console.log(`📊 Admin Dashboard: http://localhost:${PORT}/admin.html`);
            console.log(`🌐 Website: http://localhost:${PORT}`);
            console.log(`📧 Email notifications: ${transporter ? '✅ Configured' : '❌ Not configured'}`);
            console.log(`📈 API Health Check: http://localhost:${PORT}/api/health`);
            console.log(`📁 Export Orders: http://localhost:${PORT}/api/export/csv`);
            console.log(`💾 Backup Data: http://localhost:${PORT}/api/backup`);
            console.log(`💾 Data persistence: JSON files in ./data/`);
            console.log(`📦 Loaded ${orders.size} existing orders`);
            console.log(`🔢 Next order number: ${orderCounter}`);
        });
        
        // Auto-save every 5 minutes as backup
        setInterval(async () => {
            try {
                await autoSave();
                console.log('💾 Auto-save completed');
            } catch (error) {
                console.error('❌ Auto-save failed:', error);
            }
        }, 5 * 60 * 1000);
        
    } catch (error) {
        console.error('❌ Server startup failed:', error);
        process.exit(1);
    }
}

// Start the server
startServer();