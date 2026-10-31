'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

const empty = { name: '', pan: '', gstin: '', email: '', phone: '' }

export default function Clients() {
  const [clients, setClients] = useState([])
  const [form, setForm] = useState(empty)
  const [msg, setMsg] = useState('')

  async function load() {
    const { data } = await supabase.from('clients').select('*').order('created_at', { ascending: false })
    setClients(data || [])
  }
  useEffect(() => { load() }, [])

  async function add(e) {
    e.preventDefault()
    setMsg('')
    const { error } = await supabase.from('clients').insert(form)
    if (error) setMsg(error.message)
    else { setForm(empty); load() }
  }

  const input = (key, placeholder, required) => (
    <input className="border p-2 rounded w-full" placeholder={placeholder} required={required}
      value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} />
  )

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Clients</h1>

      <form onSubmit={add} className="bg-white p-4 rounded-xl shadow grid grid-cols-2 gap-3 mb-6">
        {input('name', 'Client / Company ka naam *', true)}
        {input('pan', 'PAN')}
        {input('gstin', 'GSTIN')}
        {input('email', 'Email')}
        {input('phone', 'Phone / WhatsApp (91XXXXXXXXXX)')}
        <button className="bg-blue-600 text-white rounded p-2 hover:bg-blue-700">Client add karo</button>
        {msg && <p className="text-red-600 text-sm col-span-2">{msg}</p>}
      </form>

      <div className="space-y-2">
        {clients.map((c) => (
          <div key={c.id} className="bg-white border rounded p-3">
            <b>{c.name}</b>
            <span className="text-gray-500 text-sm"> PAN: {c.pan || '-'} | GSTIN: {c.gstin || '-'} | {c.email || '-'} | {c.phone || '-'}</span>
          </div>
        ))}
        {clients.length === 0 && <p className="text-gray-500">Abhi koi client nahi hai.</p>}
      </div>
    </div>
  )
}