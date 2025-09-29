// ==============================
// API Base URL (auto-switch local vs production)
// ==============================
const API_BASE_URL =
  window.location.hostname === "localhost"
    ? "http://localhost:3000"
    : "https://ecospin-laundry.onrender.com";

// Admin Dashboard JavaScript
class AdminDashboard {
  constructor() {
    this.orders = [];
    this.summary = {};
    this.refreshInterval = null;
    this.currentTab = 'pending';
    this.init();
  }

  async init() {
    console.log("Initializing Admin Dashboard...");
    await this.loadOrderData();
    this.startAutoRefresh();
    this.bindEvents();
  }

  // Load order data from API
  async loadOrderData() {
    try {
      this.showLoading(true);
      this.hideError();

      const response = await fetch(`${API_BASE_URL}/api/orders`);
      const data = await response.json();

      if (data.success) {
        this.orders = data.orders;
        this.summary = data.summary;
        this.renderDashboard();
        console.log(`Loaded ${this.orders.length} orders`);
      } else {
        throw new Error(data.message || "Failed to load orders");
      }
    } catch (error) {
      console.error("Error loading orders:", error);
      this.showError();
    } finally {
      this.showLoading(false);
    }
  }

  // Render the complete dashboard
  renderDashboard() {
    this.renderStats();
    this.renderOrdersByTab();
    this.updateTabCounts();
    this.showDashboard();

    // Show notification if there are pending orders
    if (this.summary.pending > 0) {
      this.showNotification(
        `You have ${this.summary.pending} pending payment(s)`,
        "warning"
      );
    }
  }

  // Switch between order tabs
  switchTab(tab) {
    this.currentTab = tab;
    
    // Update tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
    
    this.renderOrdersByTab();
  }

  // Update tab counts
  updateTabCounts() {
    document.getElementById('pendingCount').textContent = 
      this.orders.filter(o => o.status === 'pending_payment').length;
    
    document.getElementById('paidCount').textContent = 
      this.orders.filter(o => o.status === 'paid').length;
    
    document.getElementById('progressCount').textContent = 
      this.orders.filter(o => ['pickup_scheduled', 'picked_up', 'in_progress', 'ready_for_delivery'].includes(o.status)).length;
    
    document.getElementById('completedCount').textContent = 
      this.orders.filter(o => o.status === 'delivered').length;
  }

  // Render statistics cards
  renderStats() {
    const statsGrid = document.getElementById("statsGrid");

    const stats = [
      {
        title: "Total Orders",
        value: this.summary.total,
        icon: "fas fa-shopping-cart",
        color: "default",
      },
      {
        title: "Pending Payment",
        value: this.summary.pending,
        icon: "fas fa-clock",
        color: "warning",
      },
      {
        title: "In Progress",
        value: this.summary.in_progress,
        icon: "fas fa-cogs",
        color: "info",
      },
      {
        title: "Completed Orders",
        value: this.summary.completed,
        icon: "fas fa-check-circle",
        color: "success",
      },
      {
        title: "Total Revenue",
        value: `KSH ${this.summary.totalRevenue.toLocaleString()}`,
        icon: "fas fa-money-bill-wave",
        color: "revenue",
      },
      {
        title: "Pending Revenue",
        value: `KSH ${this.summary.pendingRevenue.toLocaleString()}`,
        icon: "fas fa-hourglass-half",
        color: "pending-revenue",
      },
    ];

    statsGrid.innerHTML = stats
      .map(
        (stat) => `
            <div class="stat-card ${stat.color}">
                <i class="${stat.icon}"></i>
                <h3>${stat.value}</h3>
                <p>${stat.title}</p>
            </div>
        `
      )
      .join("");
  }

  // Render orders by current tab
  renderOrdersByTab() {
    const container = document.getElementById("ordersContainer");
    let filteredOrders = [];

    switch(this.currentTab) {
      case 'pending':
        filteredOrders = this.orders.filter(o => o.status === 'pending_payment');
        break;
      case 'paid':
        filteredOrders = this.orders.filter(o => o.status === 'paid');
        break;
      case 'in_progress':
        filteredOrders = this.orders.filter(o => 
          ['pickup_scheduled', 'picked_up', 'in_progress', 'ready_for_delivery'].includes(o.status)
        );
        break;
      case 'completed':
        filteredOrders = this.orders.filter(o => o.status === 'delivered');
        break;
      default:
        filteredOrders = this.orders;
    }

    if (filteredOrders.length === 0) {
      container.innerHTML = this.renderEmptyState();
    } else {
      container.innerHTML = this.renderOrdersTable(filteredOrders);
    }
  }

  // Render empty state
  renderEmptyState() {
    const messages = {
      'pending': { icon: 'fas fa-check-circle', title: 'No Pending Payments', text: 'All orders are up to date!' },
      'paid': { icon: 'fas fa-credit-card', title: 'No Paid Orders', text: 'Paid orders will appear here.' },
      'in_progress': { icon: 'fas fa-cogs', title: 'No Orders In Progress', text: 'Orders being processed will appear here.' },
      'completed': { icon: 'fas fa-trophy', title: 'No Completed Orders', text: 'Completed orders will appear here.' }
    };

    const msg = messages[this.currentTab] || messages['pending'];

    return `
      <div class="empty-state">
        <i class="${msg.icon}"></i>
        <h4>${msg.title}</h4>
        <p>${msg.text}</p>
      </div>
    `;
  }

  // Render orders table
  renderOrdersTable(orders) {
    const displayOrders = this.currentTab === 'completed' ? orders.slice(0, 20) : orders;

    return `
      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th>Order ID</th>
              <th>Customer</th>
              <th>Phone</th>
              <th>Service</th>
              <th>Amount</th>
              <th>Status</th>
              <th>Pickup</th>
              <th>Delivery</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${displayOrders.map(order => this.renderOrderRow(order)).join("")}
          </tbody>
        </table>
      </div>
      ${orders.length > 20 && this.currentTab === 'completed' ? `
        <div style="padding: 15px; text-align: center; color: #666; background: #f8f9fa;">
          Showing latest 20 orders. Total: ${orders.length} completed orders.
        </div>
      ` : ''}
    `;
  }

  // Render individual order row
  renderOrderRow(order) {
    const statusClass = this.getStatusClass(order.status);
    
    return `
      <tr class="order-row">
        <td><span class="order-id">${order.id}</span></td>
        <td>${order.customerName}</td>
        <td>
          <a href="tel:${order.customerPhone}" class="phone-link">
            <i class="fas fa-phone"></i> ${order.customerPhone}
          </a>
        </td>
        <td>${order.service}</td>
        <td><span class="amount">KSH ${order.price.toLocaleString()}</span></td>
        <td><span class="status ${statusClass}">${this.formatStatus(order.status)}</span></td>
        <td>
          ${order.pickupDate ? 
            `<span class="date-scheduled">${new Date(order.pickupDate).toLocaleDateString()}</span>` : 
            '<span class="no-date">Not scheduled</span>'
          }
        </td>
        <td>
          ${order.deliveryDate ? 
            `<span class="date-scheduled">${new Date(order.deliveryDate).toLocaleDateString()}</span>` : 
            '<span class="no-date">Not scheduled</span>'
          }
        </td>
        <td>
          <div class="action-buttons">
            ${this.renderActionButtons(order)}
          </div>
        </td>
      </tr>
    `;
  }

  // Render action buttons based on order status
  renderActionButtons(order) {
    let buttons = [];

    // Manage button (always available)
    buttons.push(`
      <button class="btn btn-sm btn-primary" onclick="adminDashboard.showOrderModal('${order.id}')" title="Manage Order">
        <i class="fas fa-edit"></i>
      </button>
    `);

    // Quick payment confirmation for pending orders
    if (order.status === 'pending_payment') {
      buttons.push(`
        <button class="btn btn-sm btn-success" onclick="adminDashboard.showConfirmModal('${order.id}')" title="Confirm Payment">
          <i class="fas fa-check"></i>
        </button>
      `);
    }

    // Delete button (for pending orders only)
    if (order.status === 'pending_payment') {
      buttons.push(`
        <button class="btn btn-sm btn-danger" onclick="adminDashboard.deleteOrder('${order.id}')" title="Delete Order">
          <i class="fas fa-trash"></i>
        </button>
      `);
    }

    return buttons.join('');
  }

  // Get CSS class for status
  getStatusClass(status) {
    const statusClasses = {
      'pending_payment': 'pending',
      'paid': 'success',
      'pickup_scheduled': 'info',
      'picked_up': 'info',
      'in_progress': 'warning',
      'ready_for_delivery': 'primary',
      'delivered': 'success'
    };
    return statusClasses[status] || 'default';
  }

  // Format status for display
  formatStatus(status) {
    return status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  }

  // Show order management modal
  showOrderModal(orderId) {
    const order = this.orders.find(o => o.id === orderId);
    if (!order) return;

    const modal = document.getElementById('orderModal');
    const modalId = document.getElementById('orderModalId');
    const orderDetails = document.getElementById('orderDetails');
    
    modalId.textContent = orderId;
    
    // Populate order details
    orderDetails.innerHTML = `
      <div class="order-info-grid">
        <div class="info-item">
          <label>Customer:</label>
          <span>${order.customerName}</span>
        </div>
        <div class="info-item">
          <label>Phone:</label>
          <span>${order.customerPhone}</span>
        </div>
        <div class="info-item">
          <label>Service:</label>
          <span>${order.service}</span>
        </div>
        <div class="info-item">
          <label>Amount:</label>
          <span>KSH ${order.price.toLocaleString()}</span>
        </div>
        <div class="info-item">
          <label>Address:</label>
          <span>${order.address}</span>
        </div>
        <div class="info-item">
          <label>Customer Notes:</label>
          <span>${order.notes || 'None'}</span>
        </div>
        <div class="info-item">
          <label>Created:</label>
          <span>${new Date(order.createdAt).toLocaleString()}</span>
        </div>
        <div class="info-item">
          <label>M-Pesa Code:</label>
          <span>${order.mpesaCode || 'N/A'}</span>
        </div>
      </div>
    `;

    // Populate form fields
    document.getElementById('orderStatus').value = order.status;
    document.getElementById('pickupDate').value = order.pickupDate ? 
      new Date(order.pickupDate).toISOString().slice(0, 16) : '';
    document.getElementById('deliveryDate').value = order.deliveryDate ? 
      new Date(order.deliveryDate).toISOString().slice(0, 16) : '';
    document.getElementById('adminNotes').value = order.adminNotes || '';
    document.getElementById('notifyCustomer').checked = false;

    modal.style.display = 'block';

    // Bind update button
    document.getElementById('updateOrderBtn').onclick = () => this.updateOrder(orderId);
  }

  // Close order modal
  closeOrderModal() {
    document.getElementById('orderModal').style.display = 'none';
  }

  // Update order
  async updateOrder(orderId) {
    try {
      const status = document.getElementById('orderStatus').value;
      const pickupDate = document.getElementById('pickupDate').value;
      const deliveryDate = document.getElementById('deliveryDate').value;
      const adminNotes = document.getElementById('adminNotes').value;
      const notifyCustomer = document.getElementById('notifyCustomer').checked;

      const updateBtn = document.getElementById('updateOrderBtn');
      const originalText = updateBtn.innerHTML;
      
      updateBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Updating...';
      updateBtn.disabled = true;

      const updateData = {
        status,
        adminNotes,
        notifyCustomer
      };

      // Add dates if provided
      if (pickupDate) updateData.pickupDate = new Date(pickupDate).toISOString();
      if (deliveryDate) updateData.deliveryDate = new Date(deliveryDate).toISOString();

      const response = await fetch(`${API_BASE_URL}/api/order/${orderId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData)
      });

      const data = await response.json();

      if (data.success) {
        this.showNotification('Order updated successfully!', 'success');
        this.closeOrderModal();
        setTimeout(() => this.loadOrderData(), 1000);
      } else {
        throw new Error(data.message || 'Failed to update order');
      }

      updateBtn.innerHTML = originalText;
      updateBtn.disabled = false;

    } catch (error) {
      console.error('Error updating order:', error);
      this.showNotification(`Error: ${error.message}`, 'error');
      
      const updateBtn = document.getElementById('updateOrderBtn');
      updateBtn.innerHTML = '<i class="fas fa-save"></i> Update Order';
      updateBtn.disabled = false;
    }
  }

  // Show confirmation modal
  showConfirmModal(orderId) {
    const modal = document.getElementById("confirmModal");
    const orderIdElement = document.getElementById("confirmOrderId");
    const confirmBtn = document.getElementById("confirmPaymentBtn");

    orderIdElement.textContent = orderId;
    modal.style.display = "block";

    // Reset input + errors
    document.getElementById("mpesaReference").value = "";
    document.getElementById("validationError").style.display = "none";

    // Bind confirm button
    confirmBtn.onclick = () => this.confirmPayment(orderId);
  }

  // Close confirmation modal
  closeConfirmModal() {
    document.getElementById("confirmModal").style.display = "none";
  }

  // Confirm payment for an order
  async confirmPayment(orderId) {
    try {
      const mpesaCode = document
        .getElementById("mpesaReference")
        .value.trim()
        .toUpperCase();

      const validationError = document.getElementById("validationError");

      if (!mpesaCode || mpesaCode.length < 8) {
        validationError.style.display = "block";
        validationError.querySelector("span").textContent =
          "Please enter a valid M-Pesa reference code.";
        return;
      } else {
        validationError.style.display = "none";
      }

      const confirmBtn = document.getElementById("confirmPaymentBtn");
      const originalText = confirmBtn.innerHTML;

      // Show loading state
      confirmBtn.innerHTML =
        '<i class="fas fa-spinner fa-spin"></i> Confirming...';
      confirmBtn.disabled = true;

      const response = await fetch(
        `${API_BASE_URL}/api/confirm-payment/${orderId}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mpesaCode }),
        }
      );

      const data = await response.json();

      if (data.success) {
        this.showNotification("Payment confirmed successfully!", "success");
        this.closeConfirmModal();

        setTimeout(() => {
          this.loadOrderData();
        }, 1000);
      } else {
        throw new Error(data.message || "Failed to confirm payment");
      }

      // Reset button
      confirmBtn.innerHTML = originalText;
      confirmBtn.disabled = false;
    } catch (error) {
      console.error("Error confirming payment:", error);
      this.showNotification(`Error: ${error.message}`, "error");

      const confirmBtn = document.getElementById("confirmPaymentBtn");
      confirmBtn.innerHTML = '<i class="fas fa-check"></i> Confirm Payment';
      confirmBtn.disabled = false;
    }
  }

  // Delete order
  async deleteOrder(orderId) {
    if (!confirm(`Are you sure you want to delete order ${orderId}?`)) return;
    
    try {
      const res = await fetch(`${API_BASE_URL}/api/order/${orderId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      
      if (data.success) {
        this.showNotification(`Order ${orderId} deleted`, "success");
        this.loadOrderData();
      } else {
        throw new Error(data.message || "Failed to delete order");
      }
    } catch (err) {
      console.error("Delete error:", err);
      this.showNotification(
        `Failed to delete order: ${err.message}`,
        "error"
      );
    }
  }

  // Show notification
  showNotification(message, type = "info") {
    const container = document.getElementById("notifications");
    const notification = document.createElement("div");

    const icons = {
      success: "fas fa-check-circle",
      error: "fas fa-exclamation-circle",
      warning: "fas fa-exclamation-triangle",
      info: "fas fa-info-circle",
    };

    notification.className = `notification ${type}`;
    notification.innerHTML = `
      <i class="${icons[type]}"></i>
      <span>${message}</span>
    `;

    container.appendChild(notification);

    setTimeout(() => {
      notification.style.animation = "slideOut 0.3s ease";
      setTimeout(() => {
        if (container.contains(notification)) {
          container.removeChild(notification);
        }
      }, 300);
    }, 4000);
  }

  // Show/hide loading state
  showLoading(show) {
    document.getElementById("loading").style.display = show ? "block" : "none";
  }

  // Show/hide dashboard content
  showDashboard() {
    document.getElementById("dashboard-content").style.display = "block";
  }

  // Show/hide error state
  showError() {
    document.getElementById("error").style.display = "block";
  }

  hideError() {
    document.getElementById("error").style.display = "none";
  }

  // Start auto-refresh
  startAutoRefresh() {
    this.refreshInterval = setInterval(() => {
      console.log("Auto-refreshing dashboard...");
      this.loadOrderData();
    }, 120000);
  }

  stopAutoRefresh() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }
  }

  // Bind event handlers
  bindEvents() {
    // Modal click handlers
    window.onclick = (event) => {
      const confirmModal = document.getElementById("confirmModal");
      const orderModal = document.getElementById("orderModal");
      
      if (event.target === confirmModal) {
        this.closeConfirmModal();
      }
      if (event.target === orderModal) {
        this.closeOrderModal();
      }
    };

    // Keyboard handlers
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        this.closeConfirmModal();
        this.closeOrderModal();
      }
    });

    // Window focus handler
    window.addEventListener("focus", () => {
      console.log("Window focused - refreshing data...");
      this.loadOrderData();
    });
  }
}

// Global helpers
function closeConfirmModal() {
  window.adminDashboard.closeConfirmModal();
}

function closeOrderModal() {
  window.adminDashboard.closeOrderModal();
}

function loadOrderData() {
  window.adminDashboard.loadOrderData();
}

// Init dashboard
document.addEventListener("DOMContentLoaded", () => {
  window.adminDashboard = new AdminDashboard();
});