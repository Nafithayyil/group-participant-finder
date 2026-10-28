import { useCallback, useEffect, useState } from 'react'
import api from './api'

export interface GroupOption {
  id: string
  subject: string
}

/**
 * The live list of WhatsApp groups for the connected account, sorted by name.
 * Requires a WhatsApp connection; when disconnected the list is empty (the app
 * only shows groups while connected).
 */
export function useGroupOptions(connected = true): { groupOptions: GroupOption[]; reloadGroups: () => Promise<void> } {
  const [groupOptions, setGroupOptions] = useState<GroupOption[]>([])

  const reloadGroups = useCallback(async () => {
    if (!connected) {
      setGroupOptions([])
      return
    }
    const groups = await api
      .get<{ groups: GroupOption[] }>('/groups')
      .then((r) => r.data.groups)
      .catch(() => [] as GroupOption[])

    setGroupOptions([...groups].sort((a, b) => a.subject.localeCompare(b.subject)))
  }, [connected])

  useEffect(() => {
    reloadGroups()
  }, [reloadGroups])

  return { groupOptions, reloadGroups }
}
