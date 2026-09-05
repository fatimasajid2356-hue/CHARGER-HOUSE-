const state = {
  products: [],
  cart: JSON.parse(localStorage.getItem('cart') || '{}'), // { productId: qty }
  paymentMethod: 'cod'
};

const el = {
  grid: document.getElementById('productGrid'),
  cartCount: document.getElementById('cartCount'),
  openCartBtn: document.getElementById('openCartBtn'),
  closeCartBtn: document.getElementById('closeCartBtn'),
  overlay: document.getElementById('overlay'),
  drawer: document.getElementById('cartDrawer'),
  cartLines: document.getElementById('cartLines'),
  cartTotalRow: document.getElementById('cartTotalRow'),
  cartTotal: document.getElementById('cartTotal'),
  checkoutForm: document.getElementById('checkoutForm'),
  formError: document.getElementById('formError'),
  orderConfirmation: document.getElementById('orderConfirmation'),
  placeOrderBtn: document.getElementById('placeOrderBtn')
};

function money(n) {
  return 'Rs. ' + Number(n).toLocaleString();
}

function saveCart() {
  localStorage.setItem('cart', JSON.stringify(state.cart));
}

function effectivePrice(product) {
  return product.salePrice != null && product.salePrice < product.retailPrice
    ? product.salePrice
    : product.retailPrice;
}

async function loadProducts() {
  const res = await fetch('/api/products');
  state.products = await res.json();
  renderGrid();
  renderCart();
}

function renderGrid() {
  el.grid.innerHTML = state.products.map((p) => {
    const onSale = p.salePrice != null && p.salePrice < p.retailPrice;
    const priceHtml = onSale
      ? `<span class="price-sale">${money(p.salePrice)}</span><span class="price-retail-strike">${money(p.retailPrice)}</span>`
      : `<span class="price-plain">${money(p.retailPrice)}</span>`;
    const outOfStock = !p.stock || p.stock <= 0;
    return `
      <div class="card">
        <div class="card-image">
          ${p.image ? `<img src="${p.image}" alt="${p.name}">` : 'No image'}
        </div>
        <div class="card-body">
          <div class="card-name">${p.name}</div>
          <div class="price-row">${priceHtml}</div>
          <div class="stock-note">${outOfStock ? 'Out of stock' : p.stock + ' in stock'}</div>
          <button class="add-btn" data-id="${p.id}" ${outOfStock ? 'disabled' : ''}>
            ${outOfStock ? 'Unavailable' : 'Add to cart'}
          </button>
        </div>
      </div>
    `;
  }).join('');

  el.grid.querySelectorAll('.add-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      state.cart[id] = (state.cart[id] || 0) + 1;
      saveCart();
      renderCart();
      openCart();
    });
  });
}

function cartItemsDetailed() {
  return Object.entries(state.cart)
    .map(([id, qty]) => {
      const product = state.products.find((p) => p.id === id);
      if (!product) return null;
      return { product, qty };
    })
    .filter(Boolean);
}

function renderCart() {
  const items = cartItemsDetailed();
  const totalQty = items.reduce((sum, i) => sum + i.qty, 0);
  el.cartCount.textContent = totalQty;

  if (!items.length) {
    el.cartLines.innerHTML = '<div class="cart-empty">Your cart is empty.</div>';
    el.cartTotalRow.style.display = 'none';
    el.checkoutForm.style.display = 'none';
    return;
  }

  el.cartTotalRow.style.display = 'flex';
  el.checkoutForm.style.display = 'flex';

  let total = 0;
  el.cartLines.innerHTML = items.map(({ product, qty }) => {
    const price = effectivePrice(product);
    total += price * qty;
    return `
      <div class="cart-line">
        <div>
          <div>${product.name}</div>
          <div class="stock-note">${money(price)} each</div>
        </div>
        <div class="qty-controls">
          <button data-id="${product.id}" data-delta="-1">−</button>
          <span>${qty}</span>
          <button data-id="${product.id}" data-delta="1">+</button>
        </div>
      </div>
    `;
  }).join('');

  el.cartTotal.textContent = money(total);

  el.cartLines.querySelectorAll('button[data-delta]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      const delta = Number(btn.dataset.delta);
      state.cart[id] = (state.cart[id] || 0) + delta;
      if (state.cart[id] <= 0) delete state.cart[id];
      saveCart();
      renderCart();
    });
  });
}

function openCart() {
  el.overlay.classList.add('open');
  el.drawer.classList.add('open');
}
function closeCart() {
  el.overlay.classList.remove('open');
  el.drawer.classList.remove('open');
}

el.openCartBtn.addEventListener('click', openCart);
el.closeCartBtn.addEventListener('click', closeCart);
el.overlay.addEventListener('click', closeCart);

document.querySelectorAll('.payment-option').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.payment-option').forEach((b) => b.classList.remove('selected'));
    btn.classList.add('selected');
    state.paymentMethod = btn.dataset.method;
  });
});

el.checkoutForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  el.formError.style.display = 'none';

  const items = cartItemsDetailed().map(({ product, qty }) => ({
    id: product.id,
    name: product.name,
    price: effectivePrice(product),
    qty
  }));

  const customer = {
    name: document.getElementById('custName').value.trim(),
    phone: document.getElementById('custPhone').value.trim(),
    address: document.getElementById('custAddress').value.trim()
  };

  el.placeOrderBtn.disabled = true;
  el.placeOrderBtn.textContent = 'Placing order…';

  try {
    const res = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items, customer, paymentMethod: state.paymentMethod })
    });
    const data = await res.json();

    if (!res.ok) {
      el.formError.textContent = data.error || 'Something went wrong. Please try again.';
      el.formError.style.display = 'block';
      el.placeOrderBtn.disabled = false;
      el.placeOrderBtn.textContent = 'Place order';
      return;
    }

    state.cart = {};
    saveCart();
    renderCart();
    el.checkoutForm.style.display = 'none';
    el.cartTotalRow.style.display = 'none';

    el.orderConfirmation.style.display = 'block';
    el.orderConfirmation.textContent = state.paymentMethod === 'online'
      ? `Order #${data.order.id} received. We'll message you on WhatsApp with a payment link shortly.`
      : `Order #${data.order.id} received. Pay in cash when it's delivered, or call 0301-8400847 with any questions.`;
  } catch (err) {
    el.formError.textContent = 'Could not reach the server. Please try again.';
    el.formError.style.display = 'block';
  } finally {
    el.placeOrderBtn.disabled = false;
    el.placeOrderBtn.textContent = 'Place order';
  }
});

loadProducts();
