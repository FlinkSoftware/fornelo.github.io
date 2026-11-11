// Screenshots of the local Fornelo web app for the marketing site, at 2x. Signs in through the real sign-in page.
// Usage: node shoot.mjs <out-dir> <light|dark> <shot …>   (every shot when none named)
import puppeteer from 'puppeteer-core'
import fs from 'node:fs'
import path from 'node:path'

const APP = 'http://localhost:8080'
const [,, outDir = 'out', scheme = 'light', ...only] = process.argv
const email = process.env.FORNELO_EMAIL, password = process.env.FORNELO_PASSWORD
if (!email || !password) { console.error('Set FORNELO_EMAIL and FORNELO_PASSWORD to the local test account'); process.exit(1) }
const shotsFile = process.env.SHOTS || './shots.json'
const shots = JSON.parse(fs.readFileSync(shotsFile, 'utf8'))
fs.mkdirSync(outDir, { recursive: true })

const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
  args: ['--no-first-run', '--hide-scrollbars', '--lang=nl-NL'],
})
const page = await browser.newPage()
await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: scheme }])
await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 })

// Sign in: the app sends an unknown visitor to the auth server's page
await page.goto(APP + '/', { waitUntil: 'networkidle2' })
if (page.url().includes('/auth/login')) {
  await page.type('input[type=email]', email)
  await page.type('input[type=password]', password)
  await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle2' }), page.click('button[type=submit]')])
  await page.waitForFunction(() => !location.pathname.startsWith('/auth'), { timeout: 30000 })
  await page.waitForNetworkIdle({ idleTime: 800 })
}
const sleep = ms => new Promise(r => setTimeout(r, ms))

for (const shot of shots) {
  if (only.length && !only.includes(shot.name)) continue
  if (shot.viewport) await page.setViewport({ ...shot.viewport, deviceScaleFactor: 2 })
  else await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 })
  await page.goto(APP + shot.url, { waitUntil: 'networkidle2' })
  await page.waitForNetworkIdle({ idleTime: 800 })
  // The Nuxt devtools pill at the bottom of every dev page is not part of the app
  const hideDevtools = () => page.evaluate(() => document.querySelectorAll('[id*=nuxt-devtools], [class*=nuxt-devtools]').forEach(e => e.remove()) || [...document.querySelectorAll('*')].filter(e => e.tagName.toLowerCase().startsWith('nuxt-devtools')).forEach(e => e.remove()))
  await hideDevtools()
  if (shot.steps) {
    for (const step of shot.steps) {
      if (step.click) { await page.waitForSelector(step.click, { visible: true }); await page.click(step.click) }
      if (step.clickText) await page.evaluate(t => { const el = [...document.querySelectorAll('button, a, summary, label')].find(e => e.textContent.trim() === t); if (el) el.click(); else throw new Error('no element with text ' + t) }, step.clickText)
      if (step.type) { await page.waitForSelector(step.type[0], { visible: true }); await page.type(step.type[0], step.type[1], { delay: 20 }) }
      if (step.press) await page.keyboard.press(step.press)
      if (step.eval) await page.evaluate(step.eval)
      if (step.wait) await sleep(step.wait)
    }
    await page.waitForNetworkIdle({ idleTime: 800 }).catch(() => {})
  }
  await sleep(shot.settle || 600)
  await hideDevtools()
  const file = path.join(outDir, `${shot.name}-${scheme}.png`)
  if (shot.selector) {
    const el = await page.waitForSelector(shot.selector, { visible: true })
    await el.screenshot({ path: file })
  } else {
    await page.screenshot({ path: file, fullPage: !!shot.fullPage })
  }
  console.log('shot', file)
}
await browser.close()
