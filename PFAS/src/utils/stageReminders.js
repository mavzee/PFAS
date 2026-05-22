import { STATUS_ORDER } from './status.js'

/** Stages shown as auto reminders (Eurofins omitted — empty is the normal default). */
export const REMINDER_STAGE_ORDER = STATUS_ORDER.filter((stage) => stage !== 'Eurofins')

export const MAX_VISIBLE_ALERTS = 8

export function buildStageReminders(uncheckedCounts) {
  if (!uncheckedCounts) {
    return []
  }

  return REMINDER_STAGE_ORDER.flatMap((stage) => {    const count = uncheckedCounts[stage] ?? 0

    if (count <= 0) {
      return []
    }

    const noun = count === 1 ? 'company' : 'companies'
    const message = `${count} ${noun} with no ${stage}`

    return [
      {
        id: `stage-reminder-${stage}`,
        type: 'reminder',
        message,
        time: '',
      },
    ]
  })
}
