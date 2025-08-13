import { chromium } from 'playwright';

function parsePrice(text) {
  if (!text) return null;
  const numeric = text.replace(/[^0-9\.]/g, '').replace(/\.(?=\d{3})/g, '');
  return Number(numeric);
}

export async function parseCategory(categoryUrl) {
  const browser = await chromium.launch();
  const context = await browser.newContext({ ignoreHTTPSErrors: true });
  const page = await context.newPage();
  const products = [];
  let url = categoryUrl;
  let categoryName = '';
  try {
    while (url) {
      await page.goto(url, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('.catalog-product-item', { timeout: 10000 }).catch(() => {});
      categoryName = await page.textContent('h1').catch(() => categoryName);
      const items = await page.$$('.catalog-product-item');
      for (const item of items) {
        try {
          const titleEl = await item.$('.catalog-product-item--title');
          const title = (await titleEl?.textContent())?.trim() || '';
          const link = await titleEl?.getAttribute('href') || '';
          const priceText = await item
            .$('.catalog-product-item--price .current')
            .then(el => el?.textContent())
            .catch(() => null);
          const oldPriceText = await item
            .$('.catalog-product-item--price .old')
            .then(el => el?.textContent())
            .catch(() => null);
          const availability = (await item.$('.catalog-product-item--to-cart')) ? 'в наявності' : 'нема в наявності';
          const price = priceText ? parsePrice(priceText) : null;
          const oldPrice = oldPriceText ? parsePrice(oldPriceText) : null;
          const discount = oldPrice ? Math.round((oldPrice - price) / oldPrice * 100) : null;
          products.push({ title, price, oldPrice, link, category: categoryName?.trim() || '', availability, discount });
        } catch (err) {
          console.error('Failed to parse item', err);
        }
      }
      url = await page.evaluate(() => {
        const active = document.querySelector('.pagination .pag-item.active');
        const next = active?.nextElementSibling?.querySelector('.pag-item-button');
        return next ? next.getAttribute('data-url') : null;
      });
    }
  } finally {
    await browser.close();
  }
  return products;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const url = process.argv[2] || 'https://jabko.ua/apple-watch/';
  parseCategory(url).then(res => {
    console.log(JSON.stringify(res, null, 2));
  });
}
