import { chromium } from 'playwright';

const baseUrl = process.env.VISUAL_TEST_URL || 'http://localhost:3100';
const password = process.env.VISUAL_TEST_PASSWORD || 'stress-password';
const chromePath = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const screenshotsDir = process.env.VISUAL_SCREENSHOTS_DIR || 'C:\\Users\\Wesley\\AppData\\Local\\Temp';

const browser = await chromium.launch({ headless: true, executablePath: chromePath });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
const page = await context.newPage();
const consoleIssues = [];

page.on('console', message => {
  if (message.type() === 'error' || message.type() === 'warning') {
    consoleIssues.push(`${message.type()}: ${message.text()}`);
  }
});
page.on('pageerror', error => consoleIssues.push(`pageerror: ${error.message}`));

async function openItem(term) {
  await page.goto(`${baseUrl}/bank`, { waitUntil: 'domcontentloaded' });
  const search = page.getByPlaceholder('Buscar palavra, frase, phrasal verb ou significado...');
  await search.fill(term);
  await page.waitForTimeout(400);
  const card = page.locator('div.relative').filter({ has: page.getByText(term, { exact: true }) }).first();
  await card.getByRole('button', { name: 'Ficha' }).click({ timeout: 60_000 });
  await page.locator('div.fixed.inset-0').waitFor({ state: 'visible' });
  await page.waitForTimeout(500);
}

await page.goto(`${baseUrl}/login`, { waitUntil: 'domcontentloaded' });
await page.getByPlaceholder('Digite sua senha...').fill(password);
await page.getByRole('button', { name: 'Desbloquear Aplicação' }).click();
await page.waitForURL(`${baseUrl}/`);
await page.waitForTimeout(500);

await openItem('regular');
await page.screenshot({ path: `${screenshotsDir}\\englishhub-regular.png`, fullPage: false });
const regularVisible = await page.locator('div.fixed.inset-0').getByText('regular', { exact: true }).count();
const regularError = await page.locator('div.fixed.inset-0').getByText(/Não foi possível gerar a ficha|Não foi possível carregar a ficha/).count();

await page.locator('div.fixed.inset-0 > div').locator('button').first().click();
await openItem('Can I get a receipt, please?');
await page.screenshot({ path: `${screenshotsDir}\\englishhub-receipt.png`, fullPage: false });
const receiptVisible = await page.locator('div.fixed.inset-0').getByText('Can I get a receipt, please?', { exact: true }).count();
const receiptError = await page.locator('div.fixed.inset-0').getByText(/Não foi possível gerar a ficha|Não foi possível carregar a ficha/).count();

await browser.close();

if (!regularVisible || !receiptVisible || regularError || receiptError || consoleIssues.length) {
  console.error(JSON.stringify({ regularVisible, receiptVisible, regularError, receiptError, consoleIssues }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({
  login: 'ok',
  regular: 'rendered',
  receipt: 'rendered',
  consoleIssues: 0,
  screenshots: [`${screenshotsDir}\\englishhub-regular.png`, `${screenshotsDir}\\englishhub-receipt.png`]
}, null, 2));
