import { useEffect, useRef, useCallback } from "react"
import { io, type Socket } from "socket.io-client"
import { useSession } from "@clerk/clerk-react"
import { useAuth } from "@/contexts/AuthContext"

const API_URL = (import.meta.env.VITE_API_URL as string) || "http://localhost:3000"

type EventHandler = (data: unknown) => void

let globalSocket: Socket | null = null
let globalOrgId: string | null = null

/**
 * Connects to the Socket.io server using the Clerk JWT.
 * Joins the org room automatically and provides an `on` helper.
 *
 * Usage:
 *   const { on } = useSocket()
 *   useEffect(() => on("lead:moved", (data) => refetch()), [on])
 */
export function useSocket() {
  const { session } = useSession()
  const { orgId } = useAuth()
  const handlersRef = useRef<Map<string, Set<EventHandler>>>(new Map())

  useEffect(() => {
    if (!session || !orgId) return

    // Reuse existing socket if same org
    if (globalSocket?.connected && globalOrgId === orgId) return

    // Disconnect stale socket
    if (globalSocket) {
      globalSocket.disconnect()
      globalSocket = null
    }

    let cancelled = false

    session.getToken().then((token) => {
      if (cancelled || !token) return

      globalSocket = io(API_URL, {
        auth: { token },
        transports: ["websocket", "polling"],
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionAttempts: 10,
      })

      globalOrgId = orgId

      globalSocket.on("connect", () => {
        console.log("[socket] connected", globalSocket?.id)
      })

      globalSocket.on("disconnect", (reason) => {
        console.log("[socket] disconnected", reason)
      })

      globalSocket.on("connect_error", (err) => {
        console.warn("[socket] connect error", err.message)
      })

      // Route all events to registered handlers
      globalSocket.onAny((event: string, data: unknown) => {
        const handlers = handlersRef.current.get(event)
        if (handlers) {
          handlers.forEach((h) => h(data))
        }
      })
    })

    return () => {
      cancelled = true
    }
  }, [session, orgId])

  // Register event handler — returns cleanup fn
  const on = useCallback((event: string, handler: EventHandler): (() => void) => {
    const map = handlersRef.current
    if (!map.has(event)) map.set(event, new Set())
    map.get(event)!.add(handler)
    return () => {
      map.get(event)?.delete(handler)
    }
  }, [])

  const emit = useCallback((event: string, data?: unknown) => {
    globalSocket?.emit(event, data)
  }, [])

  return { on, emit, socket: globalSocket }
}
