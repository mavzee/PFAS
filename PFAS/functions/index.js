import { initializeApp } from 'firebase-admin/app'
import { logger } from 'firebase-functions'
import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { scrapeFedExTravelHistory } from './lib/puppeteerFedexTrack.mjs'
import { isLikelyTrackingNumber, normalizeTrackingNumber } from './lib/trackingValidation.mjs'

initializeApp()

function isWebScrapeEnabled() {
  const flag = process.env.FEDEX_ENABLE_WEB_SCRAPE

  if (flag === undefined || flag === '') {
    return true
  }

  return flag === 'true' || flag === '1'
}

export const trackFedEx = onCall(
  {
    region: 'us-central1',
    timeoutSeconds: 120,
    memory: '2GiB',
    invoker: 'public',
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Sign in to track shipments.')
    }

    if (!isWebScrapeEnabled()) {
      throw new HttpsError(
        'failed-precondition',
        'FedEx web scrape is disabled. Paste travel history HTML manually.',
      )
    }

    const trackingNumber = normalizeTrackingNumber(request.data?.trackingNumber)

    if (!isLikelyTrackingNumber(trackingNumber)) {
      throw new HttpsError('invalid-argument', 'Enter a valid FedEx tracking number (10–22 digits).')
    }

    try {
      const result = await scrapeFedExTravelHistory(trackingNumber)

      return {
        trackingNumber: result.trackingNumber,
        tbodyHtml: result.tbodyHtml,
        trackPageUrl: result.trackPageUrl,
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Could not fetch travel history from FedEx.'

      logger.error('trackFedEx scrape failed', { trackingNumber, message, error })

      throw new HttpsError('unavailable', message)
    }
  },
)
