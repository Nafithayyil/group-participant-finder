import { GroupOption } from '../lib/useGroupOptions'

// One group per webhook: a single-choice select. Keeps the current group
// listed even if WhatsApp isn't connected and it's missing from the options.
export default function GroupSelect({
  value,
  onChange,
  options,
  currentName,
  disabled = false,
  title,
  className = 'w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm',
}: {
  value: string
  onChange: (groupJid: string) => void
  options: GroupOption[]
  currentName: string | null
  disabled?: boolean
  title?: string
  className?: string
}) {
  const hasCurrent = !value || options.some((g) => g.id === value)
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled} title={title} className={className}>
      <option value="">From group…</option>
      {!hasCurrent && <option value={value}>{currentName ?? value}</option>}
      {options.map((g) => (
        <option key={g.id} value={g.id}>
          {g.subject}
        </option>
      ))}
    </select>
  )
}
