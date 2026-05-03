// Format a Date in a given IANA timezone, using one of the five dateFormat
// patterns defined in System Configuration.
//
// - default:           "<date> HH:mm"  (footer clock, last-login)
// - { seconds: true }: "<date> HH:mm:ss"  (audit timestamps)
// - { dateOnly:true }: "<date>"  (created / lastUpdated columns)
//
// Falls back to ISO-style date if the pattern isn't recognised.

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export interface FormatInZoneOptions {
  seconds?: boolean;
  dateOnly?: boolean;
}

export function formatInZone(
  date: Date,
  timezone: string,
  pattern: string,
  options: FormatInZoneOptions = {},
): string {
  const intlOpts: Intl.DateTimeFormatOptions = {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  };
  if (!options.dateOnly) {
    intlOpts.hour = '2-digit';
    intlOpts.minute = '2-digit';
    intlOpts.hour12 = false;
    if (options.seconds) intlOpts.second = '2-digit';
  }

  const parts = new Intl.DateTimeFormat('en-US', intlOpts).formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value || '';

  const y = get('year');
  const M = get('month');
  const D = get('day');
  // Some browsers return "24" for midnight in 24-hour mode — normalise to "00".
  const H = get('hour') === '24' ? '00' : get('hour');
  const m = get('minute');
  const s = get('second');

  const monthName = MONTH_NAMES[parseInt(M, 10) - 1] ?? '';
  const dShort = String(parseInt(D, 10));

  let datePart: string;
  switch (pattern) {
    case 'MM/DD/YYYY':  datePart = `${M}/${D}/${y}`; break;
    case 'DD/MM/YYYY':  datePart = `${D}/${M}/${y}`; break;
    case 'D MMM YYYY':  datePart = `${dShort} ${monthName} ${y}`; break;
    case 'MMM D, YYYY': datePart = `${monthName} ${dShort}, ${y}`; break;
    case 'YYYY-MM-DD':
    default:            datePart = `${y}-${M}-${D}`;
  }

  if (options.dateOnly) return datePart;
  const timePart = options.seconds ? `${H}:${m}:${s}` : `${H}:${m}`;
  return `${datePart} ${timePart}`;
}
