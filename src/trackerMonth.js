/** @param {Date} d */
export function ymFromDate(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  return `${y}-${m}`
}

/** @param {string} ym YYYY-MM */
export function prevYm(ym) {
  const [ys, ms] = ym.split('-').map(Number)
  const d = new Date(ys, ms - 2, 1)
  return ymFromDate(d)
}
