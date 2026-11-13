const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const pad = (n) => String(n).padStart(2, '0')
const daysIn = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate() // m = 1..12

// Period ka naam: {prev_month} = pichla mahina, {due_month} = due wala mahina, {year} = saal
function makeLabel(pattern, y, m) {
  const pm = m === 1 ? 12 : m - 1
  const py = m === 1 ? y - 1 : y
  return (pattern || '{prev_month}')
    .replaceAll('{prev_month}', `${MONTHS[pm - 1]} ${py}`)
    .replaceAll('{due_month}', `${MONTHS[m - 1]} ${y}`)
    .replaceAll('{year}', String(y))
}

export async function generateRecurring(supabase, today) {
  const { data: templates } = await supabase
    .from('recurring_templates').select('*').eq('active', true)

  const [ty, tm] = today.split('-').map(Number)
  let created = 0

  for (const t of templates || []) {
    const limit = new Date(new Date(today).getTime() + (t.lookahead_days || 45) * 86400000)
      .toISOString().slice(0, 10)

    for (let off = 0; off <= 3; off++) {
      let m = tm + off
      let y = ty
      if (m > 12) { m -= 12; y += 1 }
      if (!t.due_months.includes(m)) continue

      const day = Math.min(t.due_day, daysIn(y, m))
      const due = `${y}-${pad(m)}-${pad(day)}`
      if (due < today || due > limit) continue

      const { data: f, error } = await supabase.from('filings').insert({
        client_id: t.client_id,
        filing_type_id: t.filing_type_id,
        period: makeLabel(t.period_label, y, m),
        due_date: due,
        reminder_days: t.reminder_days,
        channels: t.channels,
        recurring_template_id: t.id,
      }).select().single()

      if (error) continue // pehle se bani hui hai (duplicate)

      if (t.assignee_ids?.length) {
        await supabase.from('filing_assignees').insert(
          t.assignee_ids.map((uid) => ({ filing_id: f.id, user_id: uid }))
        )
      }
      await supabase.from('filing_activity').insert({
        filing_id: f.id, action: 'created', note: 'Auto-generated from recurring template',
      })
      created++
    }
  }
  return created
}