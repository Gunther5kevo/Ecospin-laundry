// ==============================
// API Base URL
// ==============================
// Detect environment (local vs production)
const API_BASE_URL =
  window.location.hostname === "localhost"
    ? "http://localhost:3000"
    : "https://ecospin-laundry.onrender.com";

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
    { name: "Size 5  by 6", price: 349 },
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

// Called from "Order Now" buttons - now accepts service type only
function selectService(serviceType) {
  // Pre-select the service type
  document.getElementById("serviceType").value = serviceType;
  updateServiceOptions();

  openOrderModal();
}

// Update service options dropdown based on selected service type
function updateServiceOptions() {
  const serviceType = document.getElementById("serviceType").value;
  const serviceOptionSelect = document.getElementById("serviceOption");
  const priceInput = document.getElementById("price");

  // Clear previous options
  serviceOptionSelect.innerHTML = '<option value="">Select an option</option>';
  priceInput.value = "";

  if (serviceType && serviceOptions[serviceType]) {
    // Add options for selected service type
    serviceOptions[serviceType].forEach((option, index) => {
      const optionElement = document.createElement("option");
      optionElement.value = index;
      optionElement.textContent = `${option.name} - KSH ${option.price}`;
      serviceOptionSelect.appendChild(optionElement);
    });

    // Enable the service option dropdown
    serviceOptionSelect.disabled = false;
  } else {
    // Disable the service option dropdown
    serviceOptionSelect.disabled = true;
  }
}

// Update price based on selected service option
function updatePrice() {
  const serviceType = document.getElementById("serviceType").value;
  const serviceOptionIndex = document.getElementById("serviceOption").value;
  const priceInput = document.getElementById("price");

  if (serviceType && serviceOptionIndex !== "" && serviceOptions[serviceType]) {
    const selectedOption =
      serviceOptions[serviceType][parseInt(serviceOptionIndex)];
    if (selectedOption) {
      priceInput.value = selectedOption.price;
    }
  } else {
    priceInput.value = "";
  }
}

// Open modal
function openOrderModal() {
  modal.style.display = "block";
}

// Close modal
function closeOrderModal() {
  modal.style.display = "none";
}

// Close when clicking outside modal
window.addEventListener("click", (e) => {
  if (e.target === modal) {
    closeOrderModal();
  }
});

// Handle form submission - MANUAL PAYMENT FLOW
orderForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const serviceType = document.getElementById("serviceType").value;
  const serviceOptionIndex = document.getElementById("serviceOption").value;
  const selectedOption =
    serviceOptions[serviceType][parseInt(serviceOptionIndex)];

  const formData = {
    service: `${getServiceTypeName(serviceType)} - ${selectedOption.name}`,
    price: selectedOption.price,
    name: document.getElementById("name").value,
    phone: document.getElementById("phone").value,
    address: document.getElementById("address").value,
    notes: document.getElementById("notes").value,
  };

  console.log("Creating manual payment order:", formData);

  // Show loading state
  const submitBtn = e.target.querySelector('button[type="submit"]');
  const originalText = submitBtn.textContent;
  submitBtn.textContent = "Creating Order...";
  submitBtn.disabled = true;

  try {
    const res = await fetch(`${API_BASE_URL}/api/create-order`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(formData),
    });

    const data = await res.json();

    if (data.success) {
      // Show payment instructions
      showPaymentInstructions(data.order);
      closeOrderModal();
      orderForm.reset();
      // Reset dropdowns
      document.getElementById("serviceType").value = "";
      updateServiceOptions();
    } else {
      alert(`❌ Order failed: ${data.message || "Unknown error"}`);
    }
  } catch (err) {
    console.error(err);
    alert("❌ Something went wrong while creating your order.");
  } finally {
    // Reset button
    submitBtn.textContent = originalText;
    submitBtn.disabled = false;
  }
});

// Helper function to get service type display name
function getServiceTypeName(serviceType) {
  const serviceTypeNames = {
    carpet: "Carpet Cleaning",
    duvet: "Duvet Cleaning",
    "small-laundry": "Small Laundry Basket",
    "large-laundry": "Large Laundry Basket",
  };
  return serviceTypeNames[serviceType] || serviceType;
}

// Show payment instructions modal
function showPaymentInstructions(order) {
  const instructionsHTML = `
    <div class="payment-instructions">
      <h3>🎉 Order Created Successfully!</h3>
      <div class="order-details">
        <p><strong>Order ID:</strong> ${order.id}</p>
        <p><strong>Service:</strong> ${order.service}</p>
        <p><strong>Amount:</strong> KSH ${order.price}</p>
      </div>
      
      <div class="payment-steps">
        <h4>📱 Payment Instructions:</h4>
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
        <h4>✅ What happens next:</h4>
        <ul>
          <li>We'll confirm your payment within 30 minutes</li>
          <li>Our team will contact you to arrange pickup</li>
          <li>We'll pick up your laundry for FREE</li>
          <li>Your clean clothes will be delivered back to you</li>
        </ul>
      </div>
      
      <div class="contact-info">
        <p><strong>Questions?</strong> Call/WhatsApp: <a href="https://wa.me/254758389387">0758389387</a></p>
      </div>
      
      <button onclick="closePaymentInstructions()" class="btn orange">Got it!</button>
    </div>
  `;

  // Create and show instructions modal
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

// Close payment instructions
function closePaymentInstructions() {
  const modal = document.getElementById("paymentInstructionsModal");
  if (modal) {
    modal.remove();
  }
}

// Expose functions globally (important for inline onclick in HTML)
window.selectService = selectService;
window.openOrderModal = openOrderModal;
window.closeOrderModal = closeOrderModal;
window.closePaymentInstructions = closePaymentInstructions;
window.updateServiceOptions = updateServiceOptions;
window.updatePrice = updatePrice;
