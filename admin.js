let adminPassword = sessionStorage.getItem('adminPassword') || '';

const gateView = document.getElementById('gateView');
const adminView = document.getElementById('adminView');
const passwordInput = document.getElementById('passwordInput');
const gateError = document.getElementById('gateError');

function money(n) {
  return 'Rs. ' + Number(n).toLocaleString();
}

async function authFetch(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: {
      ...(options.headers || {}),
      'x-admin-password': adminPassword
    }
  });
  return res;
}

async function tryEnterAdmin() {
  // Validate the password by attempting a lightweight authenticated call.
  const res = await authFetch('/api/orders');
  if (res.status === 401) {
    gateError.textContent = 'Incorrect password.';
    gateError.style.display = 'block';
    return false;
  }
  sessionStorage.setItem('adminPassword', adminPassword);
  gateView.style.display = 'none';
  adminView.style.display = 'block';
  loadProducts();
  loadOrders();
  return true;
}

document.getElementById('signInBtn').addEventListener('click', () => {
  adminPassword = passwordInput.value;
  tryEnterAdmin();
});

if (adminPassword) {
  tryEnterAdmin();
}

// ---- Products ----

async function loadProducts() {
  const res = await fetch('/api/products');
  const products = await res.json();
  const tbody = document.getElementById('productTableBody');
  tbody.innerHTML = products.map((p) => `
    <tr data-id="${p.id}">
      <td>${p.name}</td>
      <td>${money(p.retailPrice)}</td>
      <td>${p.salePrice != null ? money(p.salePrice) : '—'}</td>
      <td>${p.stock}</td>
      <td class="row-actions">
        <button class="icon-btn danger" data-action="delete" data-id="${p.id}">Delete</button>
      </td>
    </tr>
  `).join('');

  tbody.querySelectorAll('[data-action="delete"]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (!confirm('Delete this product?')) return;
      await authFetch('/api/products/' + btn.dataset.id, { method: 'DELETE' });
      loadProducts();
    });
  });
}

document.getElementById('addBtn').addEventListener('click', async () => {
  const addError = document.getElementById('addError');
  addError.style.display = 'none';

  const name = document.getElementById('fName').value.trim();
  const image = document.getElementById('fImage').value.trim();
  const retailPrice = document.getElementById('fRetail').value;
  const salePrice = document.getElementById('fSale').value;
  const stock = document.getElementById('fStock').value;

  if (!name || !retailPrice) {
    addError.textContent = 'Name and retail price are required.';
    addError.style.display = 'block';
    return;
  }

  const res = await authFetch('/api/products', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, image, retailPrice, salePrice, stock })
  });

  if (!res.ok) {
    const data = await res.json();
    addError.textContent = data.error || 'Could not add product.';
    addError.style.display = 'block';
    return;
  }

  document.getElementById('fName').value = '';
  document.getElementById('fImage').value = '';
  document.getElementById('fRetail').value = '';
  document.getElementById('fSale').value = '';
  document.getElementById('fStock').value = '0';

  loadProducts();
});

// ---- Orders ----

async function loadOrders() {
  const res = await authFetch('/api/orders');
  const orders = await res.json();
  const tbody = document.getElementById('orderTableBody');
  if (!orders.length) {
    tbody.innerHTML = '<tr><td colspan="4" class="hint">No orders yet.</td></tr>';
    return;
  }
  tbody.innerHTML = orders.slice().reverse().map((o) => `
    <tr>
      <td>#${o.id}</td>
      <td>${o.customer.name}<br><span class="hint">${o.customer.phone}</span></td>
      <td>${o.paymentMethod === 'online' ? 'Online' : 'Cash on delivery'}</td>
      <td>${o.status}</td>
    </tr>
  `).join('');
}
