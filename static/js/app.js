// app.js

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

    // Модальное окно
    const modal = document.getElementById("modal");
    const closeBtn = document.querySelector(".close");

    document.querySelectorAll("[href='#modal']").forEach(link => {
        link.addEventListener("click", e => {
            e.preventDefault();
            modal.style.display = "block";
        });
    });

    closeBtn?.addEventListener("click", () => {
        modal.style.display = "none";
    });

    window.onclick = function(event) {
        if (event.target == modal) {
            modal.style.display = "none";
        }
    };
});

// Отправка заявки в Telegram
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
НН Мебель: ${product}
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