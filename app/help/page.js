'use client'
import { HelpCircle } from 'lucide-react'
import { PageHeader } from '@/components/ui'

const GUIDE = [
  ['How do I add a filing?', 'Filings → "Add Filing". Select the client, filing type, due date, enter reminder days, and assign at least one user.'],
  ['How do monthly filings get created automatically?', 'Recurring → "New Template". Create it once, and the system will generate filings for upcoming due dates daily.'],
  ['What about many filings at once?', 'Bulk Import → Download the sample CSV, fill it in Excel, save as CSV UTF-8, and upload.'],
  ['What should I do after a filing is done?', 'Set the status to "filed". In the popup, enter the ARN number and upload the proof (PDF/photo).'],
  ['How do I add a new user or client?', 'In Team & Roles, an admin can create a new user and select their role and (for clients) the company.'],
]

const FAQ = [
  ['Reminder didn\'t arrive — what should I check?', [
    'Was a user assigned to the filing?',
    'Was the day included in reminder days? (e.g., 5,2,0)',
    'Was the channel (email / popup / Telegram) selected?',
    'For Telegram, did you connect in Settings?',
    'Did the email land in the Spam folder?',
    'Does the record appear under Reminders → "Sent"?',
  ]],
  ['Can\'t log in?', ['Double-check your email and password.', 'Only an admin can create a new account — ask your admin.']],
]

export default function Help() {
  return (
    <div className="page">
      <PageHeader icon={HelpCircle} title="Help & Support" subtitle="Everything you need to get started quickly" />

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