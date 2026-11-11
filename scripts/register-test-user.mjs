// Registers a local test user through the real flow: the form, the mail in Mailpit, the password page.
import puppeteer from 'puppeteer-core'
const [,, email, password, given, family, lang = 'en'] = process.argv
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--no-first-run', `--lang=${lang}`] })
const page = await browser.newPage()
await page.goto('http://localhost:8080/register', { waitUntil: 'networkidle2' })
const inputs = await page.$$('input')
await inputs[0].type(given); await inputs[1].type(family); await inputs[2].type(email)
await page.click('button[type=submit]')
await page.waitForFunction(() => location.pathname.includes('verify-email'), { timeout: 20000 })
let link = null
for (let i = 0; i < 20 && !link; i++) {
  await new Promise(r => setTimeout(r, 1500))
  const res = await (await fetch('http://localhost:8025/api/v1/search?query=' + encodeURIComponent('to:' + email))).json()
  if (res.messages?.length) {
    const m = await (await fetch('http://localhost:8025/api/v1/message/' + res.messages[0].ID)).json()
    link = ((m.Text || '') + (m.HTML || '')).match(/http:\/\/localhost:8080\/verify-email\/[0-9a-f-]+/)?.[0]
  }
}
if (!link) throw new Error('no verification mail')
await page.goto(link, { waitUntil: 'networkidle2' })
await page.waitForSelector('input[type=password]', { visible: true })
const pw = await page.$$('input[type=password]')
await pw[0].type(password); await pw[1].type(password)
// The language of the account is chosen on this page too
await page.evaluate((lang) => { const b = [...document.querySelectorAll('button')].find(b => b.textContent.trim().toLowerCase() === (lang === 'en' ? 'english' : 'nederlands')); if (b) b.click() }, lang)
await page.click('button[type=submit]')
await new Promise(r => setTimeout(r, 4000))
console.log(page.url(), '|', (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ').slice(0, 160))
await browser.close()
