import chromium from '@sparticuz/chromium'
import puppeteer from 'puppeteer-core'

// Required for headless Chromium in Cloud Functions / Cloud Run
chromium.setGraphicsMode = false

const DEFAULT_HOME_URL = 'https://www.fedex.com/en-ph/home.html'
const TRAVEL_HISTORY_SELECTOR =
  'tbody.fdx-c-table__tbody--zebra, tbody.fdx-c-table__tbody, tr.travel-history-table__row'
const RESULTS_WAIT_SELECTOR = 'a, tr.travel-history-table__row, table.fdx-c-table'

function normalizeTrackingNumber(value) {
  return String(value ?? '').replace(/\s+/g, '').trim()
}

function buildTrackPageUrl(trackingNumber) {
  return `https://www.fedex.com/fedextrack/?trknbr=${encodeURIComponent(trackingNumber)}`
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function clickViewMoreDetails(page) {
  return page.evaluate(() => {
    const links = [...document.querySelectorAll('a')]
    const link = links.find((anchor) => /^View more details\s*$/i.test(anchor.textContent.trim()))

    if (!link) {
      return false
    }

    link.click()
    return true
  })
}

async function extractTbodyHtml(page) {
  return page.evaluate((selector) => {
    const tbody =
      document.querySelector('tbody.fdx-c-table__tbody--zebra') ||
      document.querySelector('tbody.fdx-c-table__tbody')

    if (tbody) {
      return tbody.outerHTML
    }

    const rows = document.querySelectorAll('tr.travel-history-table__row')

    if (!rows.length) {
      return ''
    }

    const wrapper = document.createElement('tbody')
    wrapper.className = 'fdx-c-table__tbody fdx-c-table__tbody--zebra'
    rows.forEach((row) => wrapper.appendChild(row.cloneNode(true)))
    return wrapper.outerHTML
  }, TRAVEL_HISTORY_SELECTOR)
}

async function waitForResultsPage(browser, currentPage, timeoutMs) {
  const existingPages = new Set(await browser.pages())

  const newPagePromise = new Promise((resolve) => {
    const onTarget = async (target) => {
      if (target.type() !== 'page') {
        return
      }

      const page = await target.page()

      if (!page || existingPages.has(page)) {
        return
      }

      browser.off('targetcreated', onTarget)
      resolve(page)
    }

    browser.on('targetcreated', onTarget)
  })

  const raced = await Promise.race([
    newPagePromise,
    delay(timeoutMs).then(() => null),
  ])

  if (raced) {
    await raced.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: timeoutMs }).catch(() => undefined)
    return raced
  }

  await currentPage.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: timeoutMs }).catch(() => undefined)
  return currentPage
}

async function scrapeViaHomePage(page, browser, trackingNumber, options) {
  const homeUrl = options.homeUrl || process.env.FEDEX_HOME_URL || DEFAULT_HOME_URL
  const gotoTimeoutMs = options.gotoTimeoutMs ?? 30_000
  const resultsTimeoutMs = options.resultsTimeoutMs ?? 10_000

  await page.goto(homeUrl, { waitUntil: 'domcontentloaded', timeout: gotoTimeoutMs })
  await page.waitForSelector('#trackingModuleTrackingNum', { timeout: 15_000 })

  const input = await page.$('#trackingModuleTrackingNum')

  await input.click({ clickCount: 3 })
  await input.type(trackingNumber, { delay: 25 })

  const trackButton =
    (await page.$('button.cc-aem-c-button--primary[aria-label*="track" i]')) ||
    (await page.$('button.cc-aem-c-button--primary'))

  if (!trackButton) {
    throw new Error('FedEx Track button not found on home page.')
  }

  const resultsPage = await Promise.all([
    waitForResultsPage(browser, page, resultsTimeoutMs),
    trackButton.click(),
  ]).then(([nextPage]) => nextPage)

  await resultsPage
    .waitForSelector(RESULTS_WAIT_SELECTOR, { timeout: resultsTimeoutMs })
    .catch(() => undefined)

  return resultsPage
}

async function scrapeViaDirectUrl(page, trackingNumber, options) {
  const gotoTimeoutMs = options.gotoTimeoutMs ?? 30_000
  const resultsTimeoutMs = options.resultsTimeoutMs ?? 10_000
  const trackPageUrl = buildTrackPageUrl(trackingNumber)

  await page.goto(trackPageUrl, { waitUntil: 'domcontentloaded', timeout: gotoTimeoutMs })
  await page
    .waitForSelector(RESULTS_WAIT_SELECTOR, { timeout: resultsTimeoutMs })
    .catch(() => undefined)

  return page
}

/**
 * Automate the FedEx flowchart: home → Track → (new tab) → View more details → tbody HTML.
 */
export async function scrapeFedExTravelHistory(rawTrackingNumber, options = {}) {
  const trackingNumber = normalizeTrackingNumber(rawTrackingNumber)

  if (!trackingNumber) {
    throw new Error('Tracking number is required.')
  }

  const headless = options.headless ?? chromium.headless ?? true
  const viewMoreClicks = options.viewMoreClicks ?? 2
  const gotoTimeoutMs = options.gotoTimeoutMs ?? 30_000
  const resultsTimeoutMs = options.resultsTimeoutMs ?? 10_000
  const detailWaitMs = options.detailWaitMs ?? 2_000

  let browser

  try {
    browser = await puppeteer.launch({
      args: [...chromium.args, '--disable-dev-shm-usage', '--no-sandbox'],
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless,
    })

    const page = await browser.newPage()
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    )

    let resultsPage = page

    try {
      resultsPage = await scrapeViaHomePage(page, browser, trackingNumber, {
        ...options,
        gotoTimeoutMs,
        resultsTimeoutMs,
      })
    } catch (homeError) {
      resultsPage = await scrapeViaDirectUrl(page, trackingNumber, {
        gotoTimeoutMs,
        resultsTimeoutMs,
      })

      if (!resultsPage) {
        throw homeError
      }
    }

    for (let clickIndex = 0; clickIndex < viewMoreClicks; clickIndex += 1) {
      const clicked = await clickViewMoreDetails(resultsPage)

      if (!clicked) {
        break
      }

      await resultsPage
        .waitForSelector(TRAVEL_HISTORY_SELECTOR, { timeout: detailWaitMs })
        .catch(() => delay(detailWaitMs))
    }

    await resultsPage
      .waitForSelector(TRAVEL_HISTORY_SELECTOR, { timeout: resultsTimeoutMs })
      .catch(() => undefined)

    const tbodyHtml = await extractTbodyHtml(resultsPage)

    if (!tbodyHtml?.trim()) {
      throw new Error('FedEx travel history table not found after navigation.')
    }

    return {
      trackingNumber,
      tbodyHtml,
      trackPageUrl: resultsPage.url() || buildTrackPageUrl(trackingNumber),
    }
  } finally {
    if (browser) {
      await browser.close().catch(() => undefined)
    }
  }
}
