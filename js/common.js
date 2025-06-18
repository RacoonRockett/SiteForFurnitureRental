// js/common.js

// При загрузке страницы обновляем счетчик
window.onload = function () {
    updateCartCount();
};

// Инициализация корзины
let cart = JSON.parse(localStorage.getItem("furniture-cart")) || [];

// Добавление товара в корзину
function addToCart(productName, productImg) {
    cart.push({ name: productName, img: productImg });
    localStorage.setItem("furniture-cart", JSON.stringify(cart));
    updateCartCount();
    alert(`"${productName}" добавлен в заказ`);
}

// Показываем количество в корзине
function updateCartCount() {
    const badge = document.getElementById("cart-badge");
    badge.textContent = cart.length > 0 ? cart.length : "";
    badge.style.display = cart.length > 0 ? "inline-block" : "none";
}

// Открытие корзины
function viewCart() {
    const modal = document.getElementById("modal");
    const cartList = document.getElementById("cart-list");

    // Очистим старое содержимое
    cartList.innerHTML = "";

    if (cart.length === 0) {
        cartList.innerHTML = "<p>Корзина пуста</p>";
    } else {
        cart.forEach((item, index) => {
            const li = document.createElement("li");
            li.textContent = item.name;
            cartList.appendChild(li);
        });
    }

    modal.style.display = "block";
}

// Очистка корзины после отправки
function clearCart() {
    cart = [];
    localStorage.removeItem("furniture-cart");
    updateCartCount();
}

// Функция отправки заявки в Telegram
function sendToTelegram() {
    const name = encodeURIComponent(document.getElementById("name").value.trim());
    const phone = encodeURIComponent(document.getElementById("phone").value.trim());
    const product = encodeURIComponent(document.getElementById("product").value);
    const duration = encodeURIComponent(document.getElementById("duration").value);

    if (!name || !phone) {
        alert("Пожалуйста, заполните обязательные поля");
        return;
    }

    let productsText = "";

    if (cart.length > 0) {
        productsText = cart.map(p => `- ${p.name}`).join("\n");
    } else {
        const product = encodeURIComponent(document.getElementById("product").value);
        productsText = "- " + product;
    }

    const message = `
📦 Заявка на аренду мебели

👤 Имя: ${name}
📞 Телефон: ${phone}
|=|Мебель: ${product}
📅 Срок аренды: ${duration}
    `.trim();

    const botUrl = "https://t.me/RacoonRocket_bot";  // замени на свой ник
    const fullUrl = `${botUrl}?text=${message}`;

    window.open(fullUrl, "_blank");
}

// Обновление изображения при выборе товара
function updateProductImage() {
    const select = document.getElementById("product");
    const image = document.getElementById("product-image");
    const selectedOption = select.options[select.selectedIndex];
    const imgSrc = selectedOption.getAttribute("data-img");

    if (imgSrc) {
        image.src = imgSrc;
        image.style.display = "inline-block";
    } else {
        image.style.display = "none";
    }
}
