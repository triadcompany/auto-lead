import { useMemo } from "react"
import { useSession } from "@clerk/clerk-react"
import { createApi, type ApiClient } from "@/lib/api"

/**
 * Returns an authenticated API client bound to the current Clerk session.
 * The client is memoised — only recreated when the session changes.
 */
export function useApi(): ApiClient {
  const { session } = useSession()

  return useMemo(() => {
    const getToken = async () => {
      if (!session) return null
      try {
        return await session.getToken()
      } catch {
        return null
      }
    }
    return createApi(getToken)
  }, [session])
}
