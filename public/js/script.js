// ==============================
// API Base URL
// ==============================
const API_BASE_URL =
  (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")
    ? "http://localhost:3000"
    : "https://ecospin-laundry.onrender.com";

// ==============================
// Initialize Date Inputs
// ==============================
function initializeDateInputs() {
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  const minDate = tomorrow.toISOString().split('T')[0];
  
  const pickupDateInput = document.getElementById('pickupDate');
  const deliveryDateInput = document.getElementById('deliveryDate');
  
  if (pickupDateInput) pickupDateInput.min = minDate;
  if (deliveryDateInput) deliveryDateInput.min = minDate;
  
  // Validate delivery date is after pickup date
  if (pickupDateInput) {
    pickupDateInput.addEventListener('change', function() {
      if (this.value && deliveryDateInput) {
        const pickupDate = new Date(this.value);
        const minDeliveryDate = new Date(pickupDate);
        minDeliveryDate.setDate(minDeliveryDate.getDate() + 1);
        deliveryDateInput.min = minDeliveryDate.toISOString().split('T')[0];
        
        // Clear delivery if it's now invalid
        if (deliveryDateInput.value && new Date(deliveryDateInput.value) <= pickupDate) {
          deliveryDateInput.value = '';
        }
      }
    });
  }
}

// Call on page load
document.addEventListener('DOMContentLoaded', initializeDateInputs);

// Smooth scroll for nav links
document.querySelectorAll("nav a").forEach((anchor) => {
  anchor.addEventListener("click", (e) => {
    e.preventDefault();
    const target = document.querySelector(anchor.getAttribute("href"));
    if (target) {
      target.scrollIntoView({ behavior: "smooth" });
    }
  });
});

// Add simple fade-in effect for cards when scrolling
const cards = document.querySelectorAll(".card, .step");
const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("visible");
        observer.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.1 }
);

cards.forEach((card) => observer.observe(card));

// ==============================
// Service Options Data
// ==============================
const serviceOptions = {
  carpet: [
    { name: "Door Mats", price: 99 },
    { name: "Fluffy", price: 249 },
    { name: "Hard Carpets", price: 299 },
  ],
  duvet: [
    { name: "Size 3 by 4", price: 249 },
    { name: "Size 3 by 6", price: 299 },
    { name: "Size 4 by 6", price: 299 },
    { name: "Size 5 by 6", price: 349 },
    { name: "Size 6 by 6", price: 399 },
  ],
  "small-laundry": [{ name: "Narrow Small", price: 249 }],
  "large-laundry": [
    { name: "Narrow Large", price: 299 },
    { name: "Wide Large", price: 399 },
  ],
};

// ==============================
// Order Modal + Form Logic
// ==============================
const modal = document.getElementById("orderModal");
const orderForm = document.getElementById("orderForm");

function selectService(serviceType) {
  document.getElementById("serviceType").value = serviceType;
  updateServiceOptions();
  openOrderModal();
}

function updateServiceOptions() {
  const serviceType = document.getElementById("serviceType").value;
  const serviceOptionSelect = document.getElementById("serviceOption");
  const priceInput = document.getElementById("price");

  serviceOptionSelect.innerHTML = '<option value="">Select an option</option>';
  priceInput.value = "";

  if (serviceType && serviceOptions[serviceType]) {
    serviceOptions[serviceType].forEach((option, index) => {
      const optionElement = document.createElement("option");
      optionElement.value = index;
      optionElement.textContent = `${option.name} - KSH ${option.price}`;
      serviceOptionSelect.appendChild(optionElement);
    });
    serviceOptionSelect.disabled = false;
  } else {
    serviceOptionSelect.disabled = true;
  }
}

function updatePrice() {
  const serviceType = document.getElementById("serviceType").value;
  const serviceOptionIndex = document.getElementById("serviceOption").value;
  const priceInput = document.getElementById("price");

  if (serviceType && serviceOptionIndex !== "" && serviceOptions[serviceType]) {
    const selectedOption = serviceOptions[serviceType][parseInt(serviceOptionIndex)];
    if (selectedOption) {
      priceInput.value = selectedOption.price;
    }
  } else {
    priceInput.value = "";
  }
}

function openOrderModal() {
  modal.style.display = "block";
  initializeDateInputs(); // Re-initialize dates when modal opens
}

function closeOrderModal() {
  modal.style.display = "none";
}

window.addEventListener("click", (e) => {
  if (e.target === modal) {
    closeOrderModal();
  }
});

// ==============================
// Handle Form Submission with Scheduling
// ==============================
orderForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const serviceType = document.getElementById("serviceType").value;
  const serviceOptionIndex = document.getElementById("serviceOption").value;

  if (!serviceType || serviceOptionIndex === "") {
    alert("Please select a service and option");
    return;
  }

  const selectedOption = serviceOptions[serviceType][parseInt(serviceOptionIndex)];

  if (!selectedOption) {
    alert("Invalid service option selected");
    return;
  }

  // Get scheduling values
  const pickupDate = document.getElementById("pickupDate").value;
  const deliveryDate = document.getElementById("deliveryDate").value;
  const preferredTime = document.getElementById("preferredTime").value;

  // Additional validation for scheduling
  if (pickupDate && deliveryDate) {
    const pickup = new Date(pickupDate);
    const delivery = new Date(deliveryDate);
    
    if (delivery <= pickup) {
      alert("Delivery date must be after pickup date");
      return;
    }
  }

  const formData = {
    service: `${getServiceTypeName(serviceType)} - ${selectedOption.name}`,
    price: selectedOption.price,
    name: document.getElementById("name").value.trim(),
    phone: document.getElementById("phone").value.trim(),
    address: document.getElementById("address").value.trim(),
    notes: document.getElementById("notes").value.trim(),
    // NEW: Add scheduling fields
    pickupDate: pickupDate || null,
    deliveryDate: deliveryDate || null,
    preferredTime: preferredTime || null
  };

  if (!formData.name || !formData.phone || !formData.address) {
    alert("Please fill in all required fields (Name, Phone, Address)");
    return;
  }

  console.log("Creating order with schedule:", formData);

  const submitBtn = e.target.querySelector('button[type="submit"]');
  const originalText = submitBtn.textContent;
  submitBtn.textContent = "Creating Order...";
  submitBtn.disabled = true;

  try {
    const res = await fetch(`${API_BASE_URL}/api/create-order`, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify(formData),
    });

    let data;
    try {
      data = await res.json();
    } catch (parseError) {
      console.error("Failed to parse response as JSON:", parseError);
      throw new Error("Invalid response from server");
    }

    if (res.ok && data.success) {
      showPaymentInstructions(data.order);
      closeOrderModal();
      orderForm.reset();
      document.getElementById("serviceType").value = "";
      updateServiceOptions();
      initializeDateInputs(); // Reset date inputs
    } else {
      const errorMessage = data.message || `Server error (${res.status})`;
      alert(`Order failed: ${errorMessage}`);
      console.error("Order creation failed:", data);
    }
  } catch (err) {
    console.error("Order creation error:", err);
    alert("Something went wrong while creating your order. Please check your connection and try again.");
  } finally {
    submitBtn.textContent = originalText;
    submitBtn.disabled = false;
  }
});

function getServiceTypeName(serviceType) {
  const serviceTypeNames = {
    carpet: "Carpet Cleaning",
    duvet: "Duvet Cleaning",
    "small-laundry": "Small Laundry Basket",
    "large-laundry": "Large Laundry Basket",
  };
  return serviceTypeNames[serviceType] || serviceType;
}

// ==============================
// Show Payment Instructions with Schedule
// ==============================
function showPaymentInstructions(order) {
  // Format schedule information
  let scheduleHTML = '';
  if (order.pickupDate || order.deliveryDate || order.preferredTime) {
    scheduleHTML = `
      <div class="schedule-info" style="background: #f0f8ff; padding: 15px; border-radius: 8px; margin: 15px 0;">
        <h4 style="margin: 0 0 10px 0; color: #0077cc;">📅 Your Schedule:</h4>
        ${order.pickupDate ? `<p><strong>Pickup:</strong> ${new Date(order.pickupDate).toLocaleDateString('en-KE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>` : ''}
        ${order.deliveryDate ? `<p><strong>Delivery:</strong> ${new Date(order.deliveryDate).toLocaleDateString('en-KE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>` : ''}
        ${order.preferredTime ? `<p><strong>Preferred Time:</strong> ${getTimeSlotLabel(order.preferredTime)}</p>` : ''}
        ${!order.pickupDate ? `<p style="color: #666;"><em>Pickup will be arranged after payment confirmation</em></p>` : ''}
      </div>
    `;
  }

  const instructionsHTML = `
    <div class="payment-instructions">
      <h3>Order Created Successfully!</h3>
      <div class="order-details">
        <p><strong>Order ID:</strong> ${order.id}</p>
        <p><strong>Service:</strong> ${order.service}</p>
        <p><strong>Amount:</strong> KSH ${order.price}</p>
        <p><strong>Status:</strong> <span class="status-badge pending">${order.status.replace('_', ' ').toUpperCase()}</span></p>
      </div>
      
      ${scheduleHTML}
      
      <div class="payment-steps">
        <h4>Payment Instructions:</h4>
        <ol>
          <li>Open your M-Pesa menu</li>
          <li>Select "Send Money"</li>
          <li>Enter phone number: <strong>${order.mpesaInstructions.phoneNumber}</strong></li>
          <li>Enter amount: <strong>KSH ${order.mpesaInstructions.amount}</strong></li>
          <li>Use reference: <strong>${order.mpesaInstructions.reference}</strong></li>
          <li>Complete the transaction</li>
        </ol>
      </div>
      
      <div class="next-steps">
        <h4>What happens next:</h4>
        <ul>
          <li>✅ We'll confirm your payment within 30 minutes</li>
          ${order.pickupDate ? `<li>📅 We'll pick up on your scheduled date</li>` : `<li>📞 Our team will contact you to arrange pickup</li>`}
          <li>🚚 We'll pick up your laundry for FREE</li>
          ${order.deliveryDate ? `<li>📦 Your clean clothes will be delivered on ${new Date(order.deliveryDate).toLocaleDateString('en-KE', { month: 'short', day: 'numeric' })}</li>` : `<li>📦 Your clean clothes will be delivered back to you</li>`}
        </ul>
      </div>
      
      <div class="contact-info">
        <p><strong>Questions?</strong> Call/WhatsApp: <a href="https://wa.me/254758389387" target="_blank">0758389387</a></p>
      </div>
      
      <div class="order-tracking">
        <p><strong>Track your order:</strong> Save your Order ID (${order.id}) to check status anytime</p>
      </div>
      
      <button onclick="closePaymentInstructions()" class="btn orange">Got it!</button>
    </div>
  `;

  const instructionsModal = document.createElement("div");
  instructionsModal.id = "paymentInstructionsModal";
  instructionsModal.className = "modal";
  instructionsModal.style.display = "block";
  instructionsModal.innerHTML = `
    <div class="modal-content">
      <span class="close" onclick="closePaymentInstructions()">&times;</span>
      ${instructionsHTML}
    </div>
  `;

  document.body.appendChild(instructionsModal);
}

function getTimeSlotLabel(value) {
  const slots = {
    'morning': 'Morning (8AM - 12PM)',
    'afternoon': 'Afternoon (12PM - 4PM)',
    'evening': 'Evening (4PM - 6PM)',
    'anytime': 'Anytime (8AM - 6PM)'
  };
  return slots[value] || 'Flexible';
}

function closePaymentInstructions() {
  const modal = document.getElementById("paymentInstructionsModal");
  if (modal) {
    modal.remove();
  }
}

// Order tracking functionality
function trackOrder() {
  const orderId = prompt("Enter your Order ID:");
  if (!orderId) return;

  fetch(`${API_BASE_URL}/api/order/${orderId}`)
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        const order = data.order;
        let scheduleInfo = '';
        if (order.pickup_date) {
          scheduleInfo += `\nPickup: ${new Date(order.pickup_date).toLocaleDateString()}`;
        }
        if (order.delivery_date) {
          scheduleInfo += `\nDelivery: ${new Date(order.delivery_date).toLocaleDateString()}`;
        }
        alert(`Order Status: ${order.status.replace('_', ' ').toUpperCase()}\nService: ${order.service}\nAmount: KSH ${order.price}${scheduleInfo}`);
      } else {
        alert("Order not found. Please check your Order ID.");
      }
    })
    .catch(err => {
      console.error("Order tracking error:", err);
      alert("Unable to track order. Please try again later.");
    });
}

// Network status handlers
window.addEventListener('online', () => {
  console.log('Connection restored');
});

window.addEventListener('offline', () => {
  console.log('Connection lost');
  alert('No internet connection. Please check your connection and try again.');
});

// Expose functions globally
window.selectService = selectService;
window.openOrderModal = openOrderModal;
window.closeOrderModal = closeOrderModal;
window.closePaymentInstructions = closePaymentInstructions;
window.updateServiceOptions = updateServiceOptions;
window.updatePrice = updatePrice;
window.trackOrder = trackOrder;