# Fornelo marketing site

The Jekyll site for GitHub Pages that tells what Fornelo is: Dutch at `/`, English at `/en/`. The app itself lives
at https://fornelo.app (sign-up, sign-in, pricing, the legal pages); `app_url` in `_config.yml` is where every button
points. The site is served on https://fornelo.nl (`url` in `_config.yml`, `docs/CNAME`).

## Local development

### Prerequisites
- Ruby 3.3, the same as the GitHub Actions build (`brew install ruby@3.3`), or Docker.
- Node.js, or Docker.

### Jekyll
```bash
export PATH="/opt/homebrew/opt/ruby@3.3/bin:/opt/homebrew/lib/ruby/gems/3.3.0/bin:$PATH"
gem install bundler:2.5.22
bundle install
bundle exec jekyll serve
# Open http://127.0.0.1:4000
```

Without Ruby on the Mac, Docker works too (Ruby 3.1 on Linux: the locked nokogiri has no build for 3.3). The gems
are kept in the `fornelo-site-gems` volume:
```bash
docker run --rm -p 4000:4000 -v "$PWD":/srv -v fornelo-site-gems:/usr/local/bundle -w /srv ruby:3.1 bash -c "gem install bundler:2.5.22 -N && bundle _2.5.22_ install && bundle _2.5.22_ exec jekyll serve --host 0.0.0.0"
```

### CSS, JavaScript and assets
The layout inlines `docs/_includes/app.min.css`, built with Tailwind CLI v4 from `resources/css/app.css`; the
JavaScript is minified from `resources/js/app.js` to `docs/js/app.js`; the fonts and images are copied from
`resources/` to `docs/`. All three outputs are committed, GitHub Pages only runs Jekyll.

```bash
npm install
npm run build   # css, js and assets at once
npm run watch   # while developing
```

Without Node.js:
```bash
docker run --rm -v "$PWD":/srv -w /srv node:22-alpine sh -c "npm install && npm run build"
```

### Texts
Everything the visitor reads is in `docs/_data/i18n.yml`, Dutch under `nl` and English under `en`, with the same
keys. The prices there are the ones in the auth-server's `fornelo.billing.prices` and `fornelo.tiers`; change both
when one changes.

The hero's examples and the cut-outs in the features section are drawn in HTML (`docs/_includes/mocks/`), so
there are no screenshots to keep up to date.

## Deploying with GitHub Pages
The workflow in `.github/workflows/pages.yml` builds the site from the repository root (the root `_config.yml` points
Jekyll at `docs/`) and deploys it. In the repository's Settings › Pages, set **Source** to **GitHub Actions**.

## Screenshots
The screenshots under `resources/images/fornelo/` are the real app, in two local test recipe books: "Keuken van Sanne"
(Dutch, the files without prefix) and "Emma's kitchen" (English, the `en-` files), each Familie tier, eight recipes, three
members; the dish photos are AI-generated placeholders. The clips under `resources/video/` are the processing page while a page is read
(`scan-nl.mp4`, `scan-en.mp4`), a screencast of the real pipeline at work. The page that is scanned in
the hero and the scan screenshots is our own: `scripts/magazine-page.html` laid out as a magazine page and rendered to
an image, so no page of a real magazine or cookbook (someone else's copyright) appears on the site. To take them again:

1. Run the Fornelo stack locally (root `CLAUDE.md` of the Fornelo repository: compose infrastructure with the
   `pipeline` profile, auth-server, api and the web dev server on the host) and sign in to the test account.
2. Web, at 2x from a 1440×900 Chrome: `scripts/shoot-web.mjs` takes the shots in `scripts/shots.json`
   (`FORNELO_EMAIL`/`FORNELO_PASSWORD` for the account; `puppeteer-core` next to it and Google Chrome installed),
   `scripts/shoot-add.mjs` scans one page (`FORNELO_PHOTO`, the rendered `magazine-page.html`) and shoots the upload,
   processing and review steps.
3. The clip: `scripts/record-processing.mjs` screencasts the processing page while the pipeline reads the page
   (`node record-processing.mjs <account-file> <photo> <name>`, frames plus `frames.json` with their timestamps), then
   `ffmpeg -f concat -i list.txt -vf "crop=1100:1100:1130:320,scale=880:880,format=yuv420p" -r 30 -c:v libx264 -crf 23 scan.mp4`
   with the frames' own durations, so the spinners turn as they did.
4. Phones: the iOS Simulator (`xcrun simctl io <udid> screenshot`) and the Android emulator (`adb exec-out screencap -p`),
   both set to Dutch.
5. Crop (`sips --cropToHeightWidth`) and convert with `cwebp -q 82 -resize 1600 0` (web), `-resize 600 0` (phones),
   plus an `-800` variant of every web shot for the `srcset`.
