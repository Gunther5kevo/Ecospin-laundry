// Global variables
let currentService = '';
let currentPrice = 0;

// Modal functions
function openOrderModal() {
    document.getElementById('orderModal').style.display = 'block';
}

function closeOrderModal() {
    document.getElementById('orderModal').style.display = 'none';
}

function selectService(service, price) {
    currentService = service;
    currentPrice = price;
    document.getElementById('service').value = service;
    document.getElementById('price').value = price;
    openOrderModal();
}

// Close modal when clicking outside
window.onclick = function(event) {
    const modal = document.getElementById('orderModal');
    if (event.target === modal) {
        closeOrderModal();
    }
}

// Form submission
document.addEventListener('DOMContentLoaded', function() {
    const orderForm = document.getElementById('orderForm');
    
    orderForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const formData = {
            service: document.getElementById('service').value,
            price: document.getElementById('price').value,
            name: document.getElementById('name').value,
            phone: document.getElementById('phone').value,
            address: document.getElementById('address').value,
            notes: document.getElementById('notes').value
        };
        
        // Validate phone number
        if (!validatePhoneNumber(formData.phone)) {
            alert('Please enter a valid phone number starting with 254');
            return;
        }
        
        // Show loading state
        const submitBtn = document.querySelector('#orderForm button[type="submit"]');
        submitBtn.classList.add('loading');
        submitBtn.textContent = 'Processing...';
        
        try {
            const response = await fetch('/api/initiate-payment', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(formData)
            });
            
            const result = await response.json();
            
            if (result.success) {
                alert('STK Push sent to your phone. Please complete the payment.');
                closeOrderModal();
                orderForm.reset();
            } else {
                alert('Error: ' + result.message);
            }
        } catch (error) {
            console.error('Error:', error);
            alert('Network error. Please try again.');
        }
        
        // Reset button
        submitBtn.classList.remove('loading');
        submitBtn.textContent = 'Pay with M-Pesa';
    });
});

// Phone number validation
function validatePhoneNumber(phone) {
    const phoneRegex = /^254[0-9]{9}$/;
    return phoneRegex.test(phone);
}

// Format phone number as user types
document.addEventListener('DOMContentLoaded', function() {
    const phoneInput = document.getElementById('phone');
    
    phoneInput.addEventListener('input', function(e) {
        let value = e.target.value.replace(/\D/g, '');
        
        // Auto-add 254 if user starts with 0 or 7
        if (value.startsWith('0')) {
            value = '254' + value.substring(1);
        } else if (value.startsWith('7') && value.length === 9) {
            value = '254' + value;
        }
        
        e.target.value = value;
    });
});