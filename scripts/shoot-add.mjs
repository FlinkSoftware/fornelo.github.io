// The add flow: the upload page with a photo, the processing page, the review page. Scans the nasi kuning page
// once more and archives the recipe afterwards.
import puppeteer from 'puppeteer-core'
import fs from 'node:fs'
import path from 'node:path'
const APP = 'http://localhost:8080'
const outDir = process.argv[2] || 'out'
const email = process.env.FORNELO_EMAIL, password = process.env.FORNELO_PASSWORD
const photo = process.env.FORNELO_PHOTO || path.resolve('../../Fornelo/testcases/nasi-kuning/pages/1.jpg')
const sleep = ms => new Promise(r => setTimeout(r, ms))
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--no-first-run', '--hide-scrollbars', '--lang=nl-NL'] })
const page = await browser.newPage()
await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 })
await page.goto(APP + '/', { waitUntil: 'networkidle2' })
if (page.url().includes('/auth/login')) {
  await page.type('input[type=email]', email); await page.type('input[type=password]', password)
  await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle2' }), page.click('button[type=submit]')])
  await page.waitForFunction(() => !location.pathname.startsWith('/auth'), { timeout: 30000 })
}
const hide = () => page.evaluate(() => [...document.querySelectorAll('*')].filter(e => e.tagName.toLowerCase().startsWith('nuxt-devtools') || /nuxt-devtools/.test(e.id)).forEach(e => e.remove()))
const shot = async (name) => { await hide(); await page.screenshot({ path: path.join(outDir, name + '-light.png') }); console.log('shot', name) }
await page.goto(APP + '/recipes/add', { waitUntil: 'networkidle2' })
await page.waitForSelector('input[type=file]')
const input = await page.$('input[type=file]')
await input.uploadFile(photo)
await sleep(2500)
await shot('add-upload')
await page.evaluate(() => [...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Volgende').click())
await sleep(2500)
// The one-time question about helping improve the reading, if it shows again
await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Nee, liever niet'); if (b) b.click() })
await sleep(4000)
await shot('add-processing')
const recipeId = new URL(page.url()).searchParams.get('recipe')
console.log('recipe', recipeId)
// Wait for the review step (up to 4 minutes), then shoot it
await page.waitForFunction(() => document.body.innerText.includes('Controleer het hieronder'), { timeout: 240000 })
await sleep(2000)
await shot('add-review')
await page.evaluate(() => window.scrollTo(0, 0))
// Archive the extra copy again
const token = JSON.parse(await page.evaluate(() => sessionStorage.getItem('oidc.user:http://localhost:8080:fornelo-web'))).access_token
const del = await page.evaluate(async (id, token, account) => (await fetch('/api/v1/recipes/' + id, { method: 'DELETE', headers: { Authorization: 'Bearer ' + token, 'X-Account-Id': account } })).status, recipeId, token, process.env.FORNELO_ACCOUNT_ID)
console.log('archived', del)
await browser.close()
