from flask import Flask, render_template
from datetime import datetime

app = Flask(__name__, template_folder='templates', static_folder='static')


@app.route('/')
def index():
    current_year = datetime.now().year
    return render_template('index.html', current_year=datetime.now().year)


@app.route('/about')
def about():
    return render_template('about.html', current_year=datetime.now().year)


@app.route('/contacts')
def contacts():
    return render_template('contacts.html', current_year=datetime.now().year)


@app.route('/catalog')
def catalog():
    return render_template('catalog.html', current_year=datetime.now().year)


@app.route('/why-rent')
def why_rent():
    return render_template('why-rent.html', current_year=datetime.now().year)


@app.route('/gallery')
def gallery():
    return render_template('gallery.html', current_year=datetime.now().year)


@app.route('/reviews')
def reviews():
    return render_template('reviews.html', current_year=datetime.now().year)


@app.route('/order')
def order():
    return render_template('order.html', current_year=datetime.now().year)


@app.route('/pricing')
def pricing():
    return render_template('pricing.html', current_year=datetime.now().year)


if __name__ == '__main__':
    app.run(debug=True)
