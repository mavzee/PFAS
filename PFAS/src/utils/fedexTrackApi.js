import { httpsCallable } from 'firebase/functions'
import { functions } from '../firebase.js'

const trackFedExCallable = httpsCallable(functions, 'trackFedEx', { timeout: 120_000 })

function mapCallableError(error) {
  const code = error?.code || ''
  const rawMessage = String(error?.message || '').trim()
  const message =
    rawMessage && rawMessage !== 'internal' ? rawMessage : 'Could not fetch travel history from FedEx.'

  if (code === 'functions/unauthenticated') {
    return 'Sign in to the PFAS dashboard to fetch travel history automatically.'
  }

  if (code === 'functions/failed-precondition') {
    return message
  }

  if (code === 'functions/invalid-argument') {
    return message
  }

  if (code === 'functions/not-found') {
    return 'FedEx track function is not deployed. Run npm run deploy:functions, or paste HTML manually below.'
  }

  if (code === 'functions/deadline-exceeded') {
    return 'FedEx lookup timed out.'
  }

  if (code === 'functions/unavailable' || code === 'functions/internal') {
    return message
  }

  return message
}

/**
 * @param {string} trackingNumber
 * @returns {Promise<{ trackingNumber: string, tbodyHtml: string, trackPageUrl: string }>}
 */
export async function fetchFedExTravelHistory(trackingNumber) {
  try {
    const response = await trackFedExCallable({ trackingNumber })
    const data = response?.data

    if (!data?.tbodyHtml?.trim()) {
      throw new Error('FedEx returned no travel history.')
    }

    return {
      trackingNumber: data.trackingNumber || trackingNumber,
      tbodyHtml: data.tbodyHtml,
      trackPageUrl: data.trackPageUrl || '',
    }
  } catch (error) {
    const mapped = mapCallableError(error)
    const err = new Error(mapped)
    err.cause = error
    throw err
  }
}
