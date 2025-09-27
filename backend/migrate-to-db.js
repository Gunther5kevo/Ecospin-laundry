// migrate-to-db.js - Run this once to migrate existing JSON data to database
const { Pool } = require('pg');
const fs = require('fs').promises;
const path = require('path');

require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function migrateData() {
    try {
        console.log('🔄 Starting migration from JSON to database...');
        
        // Read existing JSON files
        const ORDERS_FILE = path.join(__dirname, 'data', 'orders.json');
        const COUNTER_FILE = path.join(__dirname, 'data', 'counter.json');
        
        let orders = {};
        let counter = 1;
        
        // Load orders
        try {
            const ordersData = await fs.readFile(ORDERS_FILE, 'utf8');
            orders = JSON.parse(ordersData);
            console.log(`📦 Found ${Object.keys(orders).length} orders in JSON file`);
        } catch (error) {
            console.log('📝 No existing orders file found');
        }
        
        // Load counter
        try {
            const counterData = await fs.readFile(COUNTER_FILE, 'utf8');
            const parsed = JSON.parse(counterData);
            counter = parsed.counter || 1;
            console.log(`🔢 Found counter: ${counter}`);
        } catch (error) {
            console.log('🔢 No existing counter file found');
        }
        
        // Check if database is already populated
        const existingOrders = await pool.query('SELECT COUNT(*) FROM orders');
        const existingCount = parseInt(existingOrders.rows[0].count);
        
        if (existingCount > 0) {
            console.log(`⚠️  Database already contains ${existingCount} orders`);
            console.log('Migration skipped to prevent duplicates');
            return;
        }
        
        // Migrate counter
        await pool.query(
            'INSERT INTO counters (name, value) VALUES ($1, $2) ON CONFLICT (name) DO UPDATE SET value = EXCLUDED.value',
            ['order_counter', counter]
        );
        console.log(`✅ Counter migrated: ${counter}`);
        
        // Migrate orders
        let migratedCount = 0;
        for (const [orderId, order] of Object.entries(orders)) {
            try {
                await pool.query(`
                    INSERT INTO orders (
                        id, service, price, customer_name, customer_phone, address, notes,
                        status, payment_method, mpesa_code, admin_notes, created_at, paid_at,
                        updated_at, pickup_scheduled, pickup_date, delivery_date
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
                `, [
                    order.id,
                    order.service,
                    order.price,
                    order.customerName,
                    order.customerPhone,
                    order.address,
                    order.notes || '',
                    order.status,
                    order.paymentMethod || 'manual_mpesa',
                    order.mpesaCode || null,
                    order.adminNotes || '',
                    new Date(order.createdAt),
                    order.paidAt ? new Date(order.paidAt) : null,
                    order.updatedAt ? new Date(order.updatedAt) : new Date(order.createdAt),
                    order.pickupScheduled || false,
                    order.pickupDate ? new Date(order.pickupDate) : null,
                    order.deliveryDate ? new Date(order.deliveryDate) : null
                ]);
                migratedCount++;
            } catch (error) {
                console.error(`❌ Error migrating order ${orderId}:`, error.message);
            }
        }
        
        console.log(`✅ Migration completed: ${migratedCount} orders migrated`);
        
        // Verify migration
        const finalCount = await pool.query('SELECT COUNT(*) FROM orders');
        console.log(`📊 Database now contains ${finalCount.rows[0].count} orders`);
        
        // Create backup of JSON files
        const backupDir = path.join(__dirname, 'data', 'backup');
        await fs.mkdir(backupDir, { recursive: true });
        
        try {
            await fs.copyFile(ORDERS_FILE, path.join(backupDir, `orders_backup_${new Date().toISOString().split('T')[0]}.json`));
            console.log('💾 Created backup of orders.json');
        } catch (error) {
            console.log('⚠️  Could not create backup of orders.json');
        }
        
        try {
            await fs.copyFile(COUNTER_FILE, path.join(backupDir, `counter_backup_${new Date().toISOString().split('T')[0]}.json`));
            console.log('💾 Created backup of counter.json');
        } catch (error) {
            console.log('⚠️  Could not create backup of counter.json');
        }
        
        console.log('🎉 Migration completed successfully!');
        console.log('📝 JSON backups created in data/backup/ folder');
        console.log('🚀 You can now deploy the database version');
        
    } catch (error) {
        console.error('❌ Migration failed:', error);
    } finally {
        await pool.end();
    }
}

// Run migration
migrateData();