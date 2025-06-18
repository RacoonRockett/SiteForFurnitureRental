// /static/js/app.js

let cart = [];

// Добавление товара в корзину
function addToCart(productName, productImg, quantity = 1) {
    const existingItem = cart.find(item => item.name === productName);
    if (existingItem) {
        existingItem.quantity += quantity;
    } else {
        cart.push({ name: productName, img: productImg, quantity: quantity });
    }

    updateCartCount();
    alert(`"${productName}" добавлен в заказ`);
}

// Обновление счётчика корзины
function updateCartCount() {
    const badge = document.getElementById("cart-badge");
    const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);

    badge.textContent = totalItems > 0 ? totalItems : "";
    badge.style.display = totalItems > 0 ? "inline-block" : "none";
}

// Показываем содержимое корзины в модальном окне
function viewCart() {
    const cartList = document.getElementById("cart-list");
    cartList.innerHTML = "";

    if (cart.length === 0) {
        cartList.innerHTML = "<p style='color: red;'>Корзина пуста</p>";
    } else {
        cart.forEach(item => {
            const li = document.createElement("li");
            li.textContent = `${item.name} × ${item.quantity}`;
            cartList.appendChild(li);
        });
    }
}

// Отправка заявки в Telegram
function sendToTelegram() {
    const name = encodeURIComponent(document.getElementById("name").value.trim());
    const phone = encodeURIComponent(document.getElementById("phone").value.trim());
    const duration = encodeURIComponent(document.getElementById("duration").value);

    if (!name || !phone) {
        alert("Пожалуйста, заполните обязательные поля");
        return;
    }

    let productsText = "";

    if (cart.length > 0) {
        productsText = cart.map(p => `- ${p.name} × ${p.quantity}`).join("\n");
    } else {
        const product = document.getElementById("product").value;
        productsText = "- " + product;
    }

    const message = `
📦 Заявка на аренду мебели

👤 Имя: ${name}
📞 Телефон: ${phone}
💺 Товар:
${productsText}
📅 Срок аренды: ${duration}
`.trim();

    const botUrl = "https://t.me/RacoonRocket_bot";  // замени на свой ник
    const fullUrl = `${botUrl}?text=${encodeURIComponent(message)}`;
    window.open(fullUrl, "_blank");

    clearCart();
}

// Очистка корзины после отправки
function clearCart() {
    cart = [];
    updateCartCount();
    const cartList = document.getElementById("cart-list");
    if (cartList) cartList.innerHTML = "";
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

// Анимация появления при скролле
document.addEventListener("DOMContentLoaded", function () {
    const faders = document.querySelectorAll(".fade-in");
    const appearOnScroll = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (!entry.isIntersecting) return;
            entry.target.classList.add("visible");
            observer.unobserve(entry.target);
        });
    }, { threshold: 0.1 });

    faders.forEach(el => {
        appearOnScroll.observe(el);
    });

    // Подвал
    document.getElementById("current-year") &&
        (document.getElementById("current-year").textContent = new Date().getFullYear());

    // Модальное окно
    const modal = document.getElementById("modal");
    const closeBtn = document.querySelector(".close");

    document.querySelectorAll("[href='#modal']").forEach(link => {
        link.addEventListener("click", e => {
            e.preventDefault();
            modal.style.display = "block";
            viewCart(); // обновляем список товаров
        });
    });

    closeBtn?.addEventListener("click", () => {
        modal.style.display = "none";
    });

    window.onclick = function(event) {
        if (event.target == modal) modal.style.display = "none";
    };
});
