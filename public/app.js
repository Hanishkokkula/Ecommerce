const productGrid = document.querySelector("#product-grid");
const filterList = document.querySelector("#filter-list");
const cartCount = document.querySelector("#cart-count");
const drawerCount = document.querySelector("#drawer-count");
const cartItems = document.querySelector("#cart-items");
const cartSubtotal = document.querySelector("#cart-subtotal");
const checkoutTotal = document.querySelector("#checkout-total");
const cartDrawer = document.querySelector("#cart-drawer");
const overlay = document.querySelector("#overlay");
const checkoutModal = document.querySelector("#checkout-modal");
const toast = document.querySelector("#toast");
const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

let products = [];
let selectedCategory = "All";
let cart = loadCart();
let toastTimeout;

function loadCart() {
  try {
    const saved = JSON.parse(localStorage.getItem("northstar-cart") || "[]");
    if (!Array.isArray(saved)) return [];
    return saved.filter(
      (item) =>
        Number.isSafeInteger(item.productId) &&
        Number.isSafeInteger(item.quantity) &&
        item.quantity > 0 &&
        item.quantity <= 99
    );
  } catch {
    return [];
  }
}

function saveCart() {
  localStorage.setItem("northstar-cart", JSON.stringify(cart));
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => toast.classList.remove("show"), 2300);
}

function formatPrice(cents) {
  return currency.format(cents / 100);
}

function renderFilters() {
  const categories = ["All", ...new Set(products.map((product) => product.category))];
  filterList.replaceChildren();
  categories.forEach((category) => {
    const button = document.createElement("button");
    button.className = `filter-button${category === selectedCategory ? " active" : ""}`;
    button.type = "button";
    button.textContent = category;
    button.setAttribute("aria-pressed", String(category === selectedCategory));
    button.addEventListener("click", () => {
      selectedCategory = category;
      renderFilters();
      renderProducts();
    });
    filterList.append(button);
  });
}

function renderProducts() {
  const visibleProducts =
    selectedCategory === "All"
      ? products
      : products.filter((product) => product.category === selectedCategory);
  document.querySelector("#product-count").textContent =
    `${visibleProducts.length} ${visibleProducts.length === 1 ? "piece" : "pieces"}`;
  productGrid.replaceChildren();

  visibleProducts.forEach((product) => {
    const card = document.createElement("article");
    card.className = "product-card";
    const imageWrap = document.createElement("div");
    imageWrap.className = "product-image-wrap";
    const image = document.createElement("img");
    image.className = "product-image";
    image.src = product.image_url;
    image.alt = product.name;
    image.loading = "lazy";
    imageWrap.append(image);

    const tag = document.createElement("span");
    tag.className = "product-tag";
    tag.textContent = product.stock > 0 ? product.category : "Sold out";
    imageWrap.append(tag);

    const addButton = document.createElement("button");
    addButton.className = "add-button";
    addButton.type = "button";
    addButton.textContent = "+";
    addButton.disabled = product.stock < 1;
    addButton.setAttribute(
      "aria-label",
      product.stock > 0 ? `Add ${product.name} to bag` : `${product.name} is sold out`
    );
    addButton.addEventListener("click", () => addToCart(product.id));
    imageWrap.append(addButton);

    const info = document.createElement("div");
    info.className = "product-info";
    const description = document.createElement("div");
    const name = document.createElement("h3");
    name.className = "product-name";
    name.textContent = product.name;
    const category = document.createElement("p");
    category.className = "product-category";
    category.textContent = product.category;
    description.append(name, category);
    const price = document.createElement("span");
    price.className = "product-price";
    price.textContent = formatPrice(product.price_cents);
    info.append(description, price);
    card.append(imageWrap, info);
    productGrid.append(card);
  });
}

function addToCart(productId) {
  const product = products.find((entry) => entry.id === productId);
  if (!product) return;
  const existing = cart.find((entry) => entry.productId === productId);
  const currentQuantity = existing ? existing.quantity : 0;
  if (currentQuantity >= product.stock || currentQuantity >= 99) {
    showToast("That’s all we have available right now.");
    return;
  }
  if (existing) existing.quantity += 1;
  else cart.push({ productId, quantity: 1 });
  saveCart();
  renderCart();
  showToast(`${product.name} added to your bag.`);
}

function changeQuantity(productId, amount) {
  const entry = cart.find((item) => item.productId === productId);
  const product = products.find((item) => item.id === productId);
  if (!entry || !product) return;
  const next = entry.quantity + amount;
  if (next < 1) cart = cart.filter((item) => item.productId !== productId);
  else if (next <= Math.min(product.stock, 99)) entry.quantity = next;
  else showToast("That’s all we have available right now.");
  saveCart();
  renderCart();
}

function renderCart() {
  cart = cart.filter((entry) => products.some((product) => product.id === entry.productId));
  const count = cart.reduce((total, entry) => total + entry.quantity, 0);
  cartCount.textContent = count;
  drawerCount.textContent = `(${count})`;
  cartItems.replaceChildren();

  let total = 0;
  if (cart.length === 0) {
    const empty = document.createElement("p");
    empty.className = "cart-empty";
    empty.textContent = "Your bag is waiting for something lovely.";
    cartItems.append(empty);
  }

  cart.forEach((entry) => {
    const product = products.find((item) => item.id === entry.productId);
    if (!product) return;
    total += product.price_cents * entry.quantity;
    const row = document.createElement("div");
    row.className = "cart-item";
    const image = document.createElement("img");
    image.src = product.image_url;
    image.alt = "";
    const details = document.createElement("div");
    const name = document.createElement("p");
    name.className = "cart-item-name";
    name.textContent = product.name;
    const price = document.createElement("span");
    price.className = "cart-item-price";
    price.textContent = formatPrice(product.price_cents);
    const quantity = document.createElement("div");
    quantity.className = "quantity-control";
    const decrease = document.createElement("button");
    decrease.type = "button";
    decrease.textContent = "−";
    decrease.setAttribute("aria-label", `Remove one ${product.name}`);
    decrease.addEventListener("click", () => changeQuantity(product.id, -1));
    const quantityText = document.createElement("span");
    quantityText.textContent = entry.quantity;
    const increase = document.createElement("button");
    increase.type = "button";
    increase.textContent = "+";
    increase.setAttribute("aria-label", `Add one ${product.name}`);
    increase.addEventListener("click", () => changeQuantity(product.id, 1));
    quantity.append(decrease, quantityText, increase);
    details.append(name, price, quantity);
    const remove = document.createElement("button");
    remove.className = "remove-item";
    remove.type = "button";
    remove.textContent = "Remove";
    remove.addEventListener("click", () => {
      cart = cart.filter((item) => item.productId !== product.id);
      saveCart();
      renderCart();
    });
    row.append(image, details, remove);
    cartItems.append(row);
  });

  cartSubtotal.textContent = formatPrice(total);
  checkoutTotal.textContent = formatPrice(total);
  document.querySelector("#checkout-open").disabled = cart.length === 0;
  saveCart();
}

function setDrawerOpen(open) {
  cartDrawer.classList.toggle("open", open);
  cartDrawer.setAttribute("aria-hidden", String(!open));
  overlay.hidden = !open;
  document.body.style.overflow = open ? "hidden" : "";
  if (open) document.querySelector("#cart-close").focus();
}

async function loadProducts() {
  try {
    const response = await fetch("/api/products");
    if (!response.ok) throw new Error("Could not load products.");
    products = await response.json();
    renderFilters();
    renderProducts();
    renderCart();
  } catch (error) {
    productGrid.replaceChildren();
    const message = document.createElement("p");
    message.className = "status-message";
    message.textContent = "We couldn’t load the collection. Please refresh to try again.";
    productGrid.append(message);
    console.error(error);
  }
}

document.querySelector("#cart-open").addEventListener("click", () => setDrawerOpen(true));
document.querySelector("#cart-close").addEventListener("click", () => setDrawerOpen(false));
document.querySelector("#continue-shopping").addEventListener("click", () => setDrawerOpen(false));
overlay.addEventListener("click", () => setDrawerOpen(false));

document.querySelector("#checkout-open").addEventListener("click", () => {
  if (!cart.length) return;
  setDrawerOpen(false);
  checkoutModal.hidden = false;
  document.body.style.overflow = "hidden";
  document.querySelector("#customer-name").focus();
});

function closeCheckout() {
  checkoutModal.hidden = true;
  document.body.style.overflow = "";
}

document.querySelector("#checkout-close").addEventListener("click", closeCheckout);
checkoutModal.addEventListener("click", (event) => {
  if (event.target === checkoutModal) closeCheckout();
});

document.querySelector("#checkout-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const submit = document.querySelector("#checkout-submit");
  const errorMessage = document.querySelector("#checkout-error");
  errorMessage.textContent = "";
  submit.disabled = true;
  submit.textContent = "Placing your order…";

  try {
    const formData = new FormData(form);
    const response = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customerName: formData.get("customerName"),
        email: formData.get("email"),
        address: formData.get("address"),
        items: cart.map(({ productId, quantity }) => ({ productId, quantity })),
      }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Your order could not be placed.");

    cart = [];
    saveCart();
    form.reset();
    closeCheckout();
    await loadProducts();
    showToast(`Order #${result.orderId} placed — thank you!`);
  } catch (error) {
    errorMessage.textContent = error.message;
  } finally {
    submit.disabled = false;
    submit.innerHTML = 'Place your order <span aria-hidden="true">↗</span>';
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    setDrawerOpen(false);
    closeCheckout();
  }
});

document.querySelector("#year").textContent = new Date().getFullYear();
loadProducts();
