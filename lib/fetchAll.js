// Query builder ek function se do, ye saare pages (1000-1000 karke) le aata hai
export async function fetchAll(buildQuery) {
  const size = 1000
  let from = 0
  const out = []
  while (true) {
    const { data, error } = await buildQuery().range(from, from + size - 1)
    if (error) throw error
    out.push(...data)
    if (data.length < size) break
    from += size
  }
  return out
}