const ITEMS_PER_PAGE = 6;
let products = [];
let currentPage = 1;
let cart = {};
let discountProbability = 20;
let discountPercent = 0;
let discountAvailable = false;
let discountCode = "";

function formatPrice(price) {
  return price.toLocaleString("fa-IR") + " تومان";
}

const escapeHtml = function (text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
};

const createClickTracker = () => {
  let detailsClicks = JSON.parse(localStorage.getItem("detailsClicks") || "{}");
  let cartClicks = JSON.parse(localStorage.getItem("cartClicks") || "{}");

  return {
    trackDetails: (id) => {
      detailsClicks[id] = (detailsClicks[id] || 0) + 1;
      localStorage.setItem("detailsClicks", JSON.stringify(detailsClicks));
    },
    trackCart: (id) => {
      cartClicks[id] = (cartClicks[id] || 0) + 1;
      localStorage.setItem("cartClicks", JSON.stringify(cartClicks));
    },
  };
};

const clickTracker = createClickTracker();

// Function expression for loading products
const loadProducts = async function () {
  try {
    const response = await fetch("products.json");
    if (!response.ok) throw new Error("Failed to load products");
    products = await response.json();
    renderPage();
    updateCartUI();
  } catch (error) {
    console.error("Error loading products:", error);
    showToast("خطا در بارگذاری محصولات");
  }
};

// Arrow function for rendering page
const renderPage = () => {
  const start = (currentPage - 1) * ITEMS_PER_PAGE;
  const end = start + ITEMS_PER_PAGE;
  const pageProducts = products.slice(start, end);

  const list = document.getElementById("products-list");
  list.innerHTML = "";

  pageProducts.forEach((product) => {
    const li = document.createElement("li");
    li.className = "product-card";
    li.innerHTML = `
      <div class="product-media">
        <img src="${escapeHtml(product.image)}" alt="${escapeHtml(product.name)}" loading="lazy">
      </div>
      <div class="product-body">
        <div class="name-price">
          <div class="product-name">${escapeHtml(product.name)}</div>
          <div class="product-price">${formatPrice(product.price)}</div>
        </div>
        <div class="product-actions">
          <button class="btn-ghost details-btn" data-id="${product.id}">مشاهده</button>
          <button class="btn add-to-cart-btn" data-id="${product.id}">افزودن به سبد</button>
        </div>
      </div>
    `;
    list.appendChild(li);
  });

  const totalPages = Math.ceil(products.length / ITEMS_PER_PAGE);
  document.getElementById("page-info").textContent =
    `صفحه ${currentPage} از ${totalPages}`;
  document.getElementById("page-info-bottom").textContent =
    `صفحه ${currentPage} از ${totalPages}`;

  document.getElementById("prev-page").disabled = currentPage === 1;
  document.getElementById("next-page").disabled = currentPage === totalPages;
  document.getElementById("prev-page-bottom").disabled = currentPage === 1;
  document.getElementById("next-page-bottom").disabled = currentPage === totalPages;

  localStorage.setItem("lastPage", currentPage);
};

// Function declaration for changing page
function changePage(direction, saver, getter) {
  const totalPages = Math.ceil(products.length / ITEMS_PER_PAGE);
  if (direction === "prev" && currentPage > 1) {
    currentPage--;
  } else if (direction === "next" && currentPage < totalPages) {
    currentPage++;
  }
  renderPage();
  window.scrollTo({ top: 0, behavior: "smooth" });

  // count clicks
  saver(
    "paginationClicks",
    (parseInt(getter("paginationClicks")) || 0) + 1,
  );
}

// Arrow function for adding to cart
const addToCart = (productId) => {
  cart[productId] = (cart[productId] || 0) + 1;
  saveCart();
  updateCartUI();
  showToast("محصول به سبد خرید اضافه شد");
  clickTracker.trackCart(productId);
};

// Function expression for saving cart
const saveCart = function () {
  localStorage.setItem("cart", JSON.stringify(cart));
};

// Arrow function for loading cart, page, and discount
const loadCart = () => {
  // Load cart
  const saved = localStorage.getItem("cart");
  if (saved) {
    cart = JSON.parse(saved);
  }

  // Load last page
  const lastPage = localStorage.getItem("lastPage");
  if (lastPage) {
    currentPage = parseInt(lastPage);
  }

  // Load discount
  // const savedDiscount = localStorage.getItem("discountPercent");
  // if (savedDiscount) {
    // discountPercent = parseInt(savedDiscount);
  // }
};

// Arrow function for updating cart UI
const updateCartUI = () => {
  const contents = document.getElementById("cart-contents");
  if (Object.keys(cart).length === 0) {
    contents.innerHTML =
      '<p class="empty">هیچ محصولی در سبد خرید وجود ندارد.</p>';
    return;
  }

  let html = "<ul>";
  let total = 0;
  Object.entries(cart).forEach(([id, qty]) => {
    const product = products.find((p) => p.id == id);
    if (product) {
      const subtotal = product.price * qty;
      total += subtotal;
      html += `<li><span>${escapeHtml(product.name)} (${qty})</span><span>${formatPrice(subtotal)}</span></li>`;
    }
  });
  html += "</ul>";
  html += `<div class="hr"></div>`;

  // Apply discount if any
  let discountedTotal = total;
  if (discountAvailable === true) {
    const discountAmount = (total * discountPercent) / 100;
    discountedTotal = total - discountAmount;
    html += `<div class="discount-info">تخفیف ${discountPercent}%: -${formatPrice(discountAmount)}</div>`;
  }

  html += `<div class="total"><strong>جمع کل: ${formatPrice(discountedTotal)}</strong></div>`;
  contents.innerHTML = html;
};

// Function declaration for showing modal
function showModal(productId) {
  const product = products.find((p) => p.id == productId);
  if (!product) return;

  document.getElementById("modal-title").textContent = product.name;
  document.getElementById("modal-image").src = product.image;
  document.getElementById("modal-image").alt = product.name;
  document.getElementById("modal-desc").textContent = product.description;
  document.getElementById("modal-price").textContent = formatPrice(
    product.price,
  );

  const modal = document.getElementById("product-modal");
  modal.setAttribute("aria-hidden", "false");
  modal.style.display = "flex";

  clickTracker.trackDetails(productId);
}

// Arrow function for hiding modal
const hideModal = () => {
  const modal = document.getElementById("product-modal");
  modal.setAttribute("aria-hidden", "true");
  modal.style.display = "none";
};

// Function expression for showing toast
const showToast = function (message) {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 2000);
};

// Arrow function for clearing cart
const clearCart = () => {
  cart = {};
  discountPercent = 0;
  localStorage.removeItem("discountPercent");
  saveCart();
  updateCartUI();
  showToast("سبد خرید پاک شد");
};

// Arrow function for applying discount
const applyDiscount = () => {
  const code = document.getElementById("discount-code").value.trim();
  if (code !== discountCode || discountPercent === 0) {
    showToast("کد تخفیف نامعتبر");
    return;
  }

  discountAvailable = true;
  updateCartUI();
  showToast(`تخفیف ${discountPercent}% اعمال شد`);
};

// Cookie functions (function declarations)
function setCookie(name, value, days = 7) {
  const expires = new Date();
  expires.setTime(expires.getTime() + days * 24 * 60 * 60 * 1000);
  document.cookie = `${name}=${value};expires=${expires.toUTCString()};path=/`;
}

function getCookie(name) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop().split(";").shift();
  return null;
}


// IIFE for discount code
(function () {
  if (Math.random() < discountProbability / 100) {
    discountPercent = Math.floor(Math.random() * 30) + 1;
    discountCode = `TAKHFIF_${discountPercent}`;
    setTimeout(() => {
      showToast(
        `کد تخفیف: ${discountCode} - تخفیف ${discountPercent}% ویژه برای شما!`,
      );
    }, 1000);
  }
})();

// Callback functions in event listeners
document.addEventListener("DOMContentLoaded", () => {
  loadCart();
  loadProducts();

  // Pagination callbacks
  document
    .getElementById("prev-page")
    .addEventListener("click", () => changePage("prev", setCookie, getCookie));
  document
    .getElementById("next-page")
    .addEventListener("click", () => changePage("next"), setCookie, getCookie);
  document
    .getElementById("prev-page-bottom")
    .addEventListener("click", () => changePage("prev", setCookie, getCookie));
  document
    .getElementById("next-page-bottom")
    .addEventListener("click", () => changePage("next", setCookie, getCookie));

  // Modal callbacks
  document.getElementById("modal-close").addEventListener("click", hideModal);
  document.getElementById("product-modal").addEventListener("click", (e) => {
    if (e.target === e.currentTarget) hideModal();
  });

  // Cart callbacks
  document.getElementById("clear-cart").addEventListener("click", clearCart);
  document
    .getElementById("apply-discount")
    .addEventListener("click", applyDiscount);

  // Product actions callback
  document.getElementById("products-list").addEventListener("click", (e) => {
    if (e.target.classList.contains("details-btn")) {
      const id = e.target.dataset.id;
      showModal(id);
    } else if (e.target.classList.contains("add-to-cart-btn")) {
      const id = e.target.dataset.id;
      addToCart(id);
    }
  });
});
