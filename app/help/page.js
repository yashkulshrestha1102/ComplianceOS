'use client'
import { HelpCircle } from 'lucide-react'
import { PageHeader } from '@/components/ui'

const GUIDE = [
  ['Filing kaise add karein?', 'Filings → "Filing add karo". Client, filing type, due date chuno, reminder days likho aur kam se kam ek user assign karo.'],
  ['Har mahine ki filings apne aap kaise banein?', 'Recurring → "Naya template". Ek baar banao, system roz agli due dates ki filings bana dega.'],
  ['Bahut saari filings ek saath?', 'Bulk Import → sample CSV download karo, Excel me bharo, CSV UTF-8 me save karke upload karo.'],
  ['Filing hone par kya karein?', 'Status "filed" karo. Jo popup khule usme ARN number likho aur proof (PDF/photo) upload karo.'],
  ['Naya user ya client kaise jodein?', 'Team & Roles me admin naya user bana sakta hai aur uska role aur (client ke liye) company chun sakta hai.'],
]

const FAQ = [
  ['Reminder nahi aaya, kya check karein?', [
    'Filing me kisi user ko assign kiya tha?',
    'Reminder days me wo din tha? (jaise 5,2,0)',
    'Channel (email / popup / Telegram) chuna tha?',
    'Telegram ke liye Settings me connect kiya?',
    'Email Spam folder me to nahi gayi?',
    'Reminders → "Bheje gaye" me record dikhta hai?',
  ]],
  ['Login nahi ho raha?', ['Email aur password dobara dhyan se daalo.', 'Naya account sirf admin bana sakta hai, apne admin se kaho.']],
]

export default function Help() {
  return (
    <div className="page">
      <PageHeader icon={HelpCircle} title="Help & Support" subtitle="Kaam jaldi seekhne ke liye" />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {GUIDE.map(([q, a]) => (
          <div key={q} className="card p-5">
            <div className="font-semibold mb-1">{q}</div>
            <p className="text-sm text-[var(--muted)]">{a}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {FAQ.map(([q, items]) => (
          <div key={q} className="card p-5">
            <div className="font-semibold mb-2">{q}</div>
            <ul className="text-sm text-[var(--muted)] list-disc ml-5 space-y-1">
              {items.map((i) => <li key={i}>{i}</li>)}
            </ul>
          </div>
        ))}
      </div>
    </div>
  )
}