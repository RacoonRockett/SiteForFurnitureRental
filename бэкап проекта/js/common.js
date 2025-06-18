// js/common.js

// Генерация шапки
function loadHeader() {
    const headerHTML = `
        <nav id="main-nav">
            <a href="index.html">Главная</a>
            <a href="about.html">О нас</a>
            <a href="why-rent.html">Почему аренда?</a>
            <a href="catalog.html">Каталог</a>
            <a href="pricing.html">Прайс-лист</a>
            <a href="gallery.html">Галерея</a>
            <a href="reviews.html">Отзывы</a>
            <a href="order.html">Заказать</a>
            <a href="contacts.html">Контакты</a>
            <a href="faq.html">FAQ</a>
        </nav>
    `;
    document.getElementById('header-container').innerHTML = headerHTML;
}

// Генерация подвала
function loadFooter() {
    const currentYear = new Date().getFullYear();
    const footerHTML = `
        <footer>
            &copy; ${currentYear} | Аренда офисной мебели в Петрозаводске
        </footer>
    `;
    document.getElementById('footer-container').innerHTML = footerHTML;
}
