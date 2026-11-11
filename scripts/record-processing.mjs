// Records the processing page ("We lezen je recept uit") as a continuous screencast while the real pipeline reads a
// page, so the spinners turn and the stages tick over as they do. Frames (JPEG, 2x) go to out/cast-<name>/ with
// a frames.txt of file names and timestamps for ffmpeg's concat demuxer.
// Usage: node record-processing.mjs <account-file> <photo> <name>
import puppeteer from 'puppeteer-core'
import fs from 'node:fs'
import path from 'node:path'
const [,, accountFile, photo, name] = process.argv
const [email, password] = fs.readFileSync(accountFile, 'utf8').trim().split(/\s+/)
const dir = path.resolve('out', 'cast-' + name)
fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true })
const sleep = ms => new Promise(r => setTimeout(r, ms))
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--no-first-run', '--hide-scrollbars'] })
const page = await browser.newPage()
await page.setViewport({ width: 2880, height: 1800, deviceScaleFactor: 1 })
await page.goto('http://localhost:8080/', { waitUntil: 'networkidle2' })
if (page.url().includes('/auth/login')) {
  await page.type('input[type=email]', email); await page.type('input[type=password]', password)
  await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle2' }), page.click('button[type=submit]')])
  await page.waitForFunction(() => !location.pathname.startsWith('/auth'), { timeout: 30000 })
}
const hide = () => page.evaluate(() => [...document.querySelectorAll('*')].filter(e => e.tagName.toLowerCase().startsWith('nuxt-devtools') || /nuxt-devtools/.test(e.id)).forEach(e => e.remove()))
await page.goto('http://localhost:8080/recipes/add', { waitUntil: 'networkidle2' })
await page.waitForSelector('input[type=file]')
await (await page.$('input[type=file]')).uploadFile(photo)
await sleep(1500)
await page.evaluate(() => [...document.querySelectorAll('button')].find(b => ['Volgende', 'Next'].includes(b.textContent.trim())).click())
// Wait for the processing page (the one-time consent question may sit in front of it)
await page.waitForFunction(() => /We lezen je recept uit|We're scanning your recipe|Nee, liever niet|No, rather not/.test(document.body.innerText), { timeout: 30000 })
await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(b => ['Nee, liever niet', 'No, rather not'].includes(b.textContent.trim())); if (b) b.click() })
await page.waitForFunction(() => /We lezen je recept uit|We're scanning your recipe/.test(document.body.innerText), { timeout: 30000 })
await hide()
await page.evaluate(() => { document.documentElement.style.zoom = '2' })
await sleep(600)
// The screencast: every frame the browser paints, as JPEG at the device pixel size
const client = await page.createCDPSession()
const frames = []
let t0 = null
client.on('Page.screencastFrame', async ({ data, metadata, sessionId }) => {
  const t = metadata.timestamp
  if (t0 === null) t0 = t
  const file = `${String(frames.length).padStart(5, '0')}.jpg`
  fs.writeFileSync(path.join(dir, file), Buffer.from(data, 'base64'))
  frames.push({ file, t: t - t0 })
  await client.send('Page.screencastFrameAck', { sessionId }).catch(() => {})
})
await client.send('Page.startScreencast', { format: 'jpeg', quality: 85, maxWidth: 2880, maxHeight: 1800, everyNthFrame: 1 })
const started = Date.now()
let done = false
while (!done && Date.now() - started < 240000) {
  await sleep(200)
  done = await page.evaluate(() => /Controleer het hieronder|Review it below/.test(document.body.innerText))
}
await client.send('Page.stopScreencast')
const recipeId = new URL(page.url()).searchParams.get('recipe')
// The last frames show the review page: drop everything after the processing page left
let cut = frames.length
fs.writeFileSync(path.join(dir, 'frames.json'), JSON.stringify(frames))
console.log('frames', frames.length, 'seconds', (frames.at(-1)?.t ?? 0).toFixed(1), 'recipe', recipeId)
if (recipeId) {
  const status = await page.evaluate(async (id) => {
    const u = JSON.parse(sessionStorage.getItem('oidc.user:http://localhost:8080:fornelo-web'))
    const payload = JSON.parse(atob(u.access_token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
    return (await fetch('/api/v1/recipes/' + id, { method: 'DELETE', headers: { Authorization: 'Bearer ' + u.access_token, 'X-Account-Id': payload.accounts[0].accountId } })).status
  }, recipeId)
  console.log('archived', status)
}
await browser.close()
