import useSWR from "swr"

interface HorseData {
  id: string
  name: string
  breed: string | null
  birthYear: number | null
  color: string | null
  gender: string | null
  specialNeeds: string | null
  photoUrl: string | null
  createdAt: string
}

/**
 * SWR hook for the current customer's horses (/api/horses).
 */
export function useHorses() {
  const { data, error, isLoading, mutate } = useSWR<HorseData[]>("/api/horses")
  return {
    horses: data ?? [],
    error,
    isLoading,
    mutate,
  }
}
