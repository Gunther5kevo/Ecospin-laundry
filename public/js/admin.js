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
    this.renderPendingOrders();
    this.renderCompletedOrders();
    this.showDashboard();

    // Show notification if there are pending orders
    if (this.summary.pending > 0) {
      this.showNotification(
        `You have ${this.summary.pending} pending payment(s)`,
        "warning"
      );
    }
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
        color: "default",
      },
      {
        title: "Completed Orders",
        value: this.summary.paid,
        icon: "fas fa-check-circle",
        color: "default",
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

  // Render pending orders
  renderPendingOrders() {
    const pendingOrders = this.orders.filter(
      (order) => order.status === "pending_payment"
    );
    const pendingContainer = document.getElementById("pendingOrders");
    const pendingCount = document.getElementById("pendingCount");

    pendingCount.textContent = pendingOrders.length;

    if (pendingOrders.length === 0) {
      pendingContainer.innerHTML = `
        <div class="empty-state">
          <i class="fas fa-check-circle"></i>
          <h4>No Pending Payments</h4>
          <p>All orders are up to date!</p>
        </div>
      `;
    } else {
      pendingContainer.innerHTML = `
        <div class="table-container">
          <table>
            <thead>
              <tr>
                <th>Order ID</th>
                <th>Customer</th>
                <th>Phone</th>
                <th>Service</th>
                <th>Amount</th>
                <th>Address</th>
                <th>Created</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${pendingOrders
                .map((order) => this.renderOrderRow(order, "pending"))
                .join("")}
            </tbody>
          </table>
        </div>
      `;
    }
  }

  // Render completed orders
  renderCompletedOrders() {
    const completedOrders = this.orders.filter(
      (order) => order.status === "paid"
    );
    const completedContainer = document.getElementById("completedOrders");
    const completedCount = document.getElementById("completedCount");

    completedCount.textContent = completedOrders.length;

    if (completedOrders.length === 0) {
      completedContainer.innerHTML = `
        <div class="empty-state">
          <i class="fas fa-box"></i>
          <h4>No Completed Orders Yet</h4>
          <p>Completed orders will appear here.</p>
        </div>
      `;
    } else {
      const displayOrders = completedOrders.slice(0, 20);

      completedContainer.innerHTML = `
        <div class="table-container">
          <table>
            <thead>
              <tr>
                <th>Order ID</th>
                <th>Customer</th>
                <th>Phone</th>
                <th>Service</th>
                <th>Amount</th>
                <th>Address</th>
                <th>Paid At</th>
                <th>Status</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              ${displayOrders
                .map((order) => this.renderOrderRow(order, "completed"))
                .join("")}
            </tbody>
          </table>
        </div>
        ${
          completedOrders.length > 20
            ? `
          <div style="padding: 15px; text-align: center; color: #666; background: #f8f9fa;">
            Showing latest 20 orders. Total: ${completedOrders.length} completed orders.
          </div>
        `
            : ""
        }
      `;
    }
  }

  // Render individual order row
  renderOrderRow(order, type) {
    const rowClass = type === "pending" ? "pending-row" : "paid-row";
    const statusClass = type === "pending" ? "pending" : "paid";

    return `
      <tr class="order-row ${rowClass}">
        <td><span class="order-id">${order.id}</span></td>
        <td>${order.customerName}</td>
        <td>
          <a href="tel:${order.customerPhone}" class="phone-link">
            <i class="fas fa-phone"></i> ${order.customerPhone}
          </a>
        </td>
        <td>${order.service}</td>
        <td><span class="amount">KSH ${order.price.toLocaleString()}</span></td>
        <td>
          <div style="max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${
            order.address
          }">
            ${order.address}
          </div>
        </td>
        <td>${new Date(
          type === "pending" ? order.createdAt : order.paidAt
        ).toLocaleString()}</td>
        <td><span class="status ${statusClass}">${order.status}</span></td>
        ${
          type === "pending"
            ? `
          <td>
            <button class="btn btn-success" onclick="adminDashboard.showConfirmModal('${order.id}')">
              <i class="fas fa-check"></i> Confirm Payment
            </button>
            <button class="btn btn-danger" onclick="adminDashboard.deleteOrder('${order.id}')">
              <i class="fas fa-trash"></i> Delete
            </button>
          </td>
        `
            : `
          <td>
            <span class="notes" title="${order.notes || "No notes"}">${
                order.notes || "-"
              }</span>
          </td>
        `
        }
      </tr>
    `;
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
        this.showNotification("✅ Payment confirmed successfully!", "success");
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
      this.showNotification(`❌ Error: ${error.message}`, "error");

      const confirmBtn = document.getElementById("confirmPaymentBtn");
      confirmBtn.innerHTML = '<i class="fas fa-check"></i> Confirm Payment';
      confirmBtn.disabled = false;
    }
  }

  // ✅ Delete order
  async deleteOrder(orderId) {
    if (!confirm(`Are you sure you want to delete order ${orderId}?`)) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/order/${orderId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.success) {
        this.showNotification(`🗑️ Order ${orderId} deleted`, "success");
        this.loadOrderData();
      } else {
        throw new Error(data.message || "Failed to delete order");
      }
    } catch (err) {
      console.error("Delete error:", err);
      this.showNotification(
        `❌ Failed to delete order: ${err.message}`,
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
    window.onclick = (event) => {
      const modal = document.getElementById("confirmModal");
      if (event.target === modal) {
        this.closeConfirmModal();
      }
    };

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        this.closeConfirmModal();
      }
    });

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

function loadOrderData() {
  window.adminDashboard.loadOrderData();
}

// Init dashboard
document.addEventListener("DOMContentLoaded", () => {
  window.adminDashboard = new AdminDashboard();
});
