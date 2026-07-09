import { useCallback, useEffect, useRef, useState } from 'react'
import type { Room, Self, ServerMessage } from './types'

type Command = Record<string, unknown> & { type: string }

const STORAGE_KEY = 'zaliujia-session-v1'

export function useGameSocket() {
  const socket = useRef<WebSocket | null>(null)
  const reconnectTimer = useRef<number | null>(null)
  const [room, setRoom] = useState<Room | null>(null)
  const [self, setSelf] = useState<Self | null>(null)
  const [connected, setConnected] = useState(false)
  const [error, setError] = useState('')

  const send = useCallback((command: Command) => {
    if (socket.current?.readyState !== WebSocket.OPEN) {
      setError('连接正在恢复，请稍后再试')
      return
    }
    socket.current.send(JSON.stringify(command))
  }, [])

  useEffect(() => {
    let disposed = false
    if (new URLSearchParams(location.search).get('fresh') === '1') {
      localStorage.removeItem(STORAGE_KEY)
      history.replaceState(null, '', location.pathname)
    }
    const connect = () => {
      if (disposed) return
      const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:'
      const basePath = location.pathname.startsWith('/zaliujia') ? '/zaliujia' : ''
      const ws = new WebSocket(`${protocol}//${location.host}${basePath}/ws`)
      socket.current = ws
      ws.onopen = () => {
        setConnected(true)
        const raw = localStorage.getItem(STORAGE_KEY)
        if (raw) {
          try {
            const saved = JSON.parse(raw) as { roomCode: string; token: string }
            ws.send(JSON.stringify({ type: 'reconnect', ...saved }))
          } catch { localStorage.removeItem(STORAGE_KEY) }
        }
      }
      ws.onmessage = (event) => {
        const msg = JSON.parse(event.data) as ServerMessage
        if (msg.type === 'session') {
          localStorage.setItem(STORAGE_KEY, JSON.stringify({ roomCode: msg.roomCode, token: msg.token }))
        } else if (msg.type === 'state') {
          setRoom(msg.room); setSelf(msg.self); setError('')
        } else if (msg.type === 'left') {
          localStorage.removeItem(STORAGE_KEY)
          setRoom(null); setSelf(null); setError('')
        } else if (msg.type === 'error') {
          setError(msg.message)
          if (msg.message.includes('房间不存在') || msg.message.includes('身份已失效')) localStorage.removeItem(STORAGE_KEY)
        }
      }
      ws.onclose = () => {
        setConnected(false)
        if (!disposed) reconnectTimer.current = window.setTimeout(connect, 1500)
      }
    }
    connect()
    return () => {
      disposed = true
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current)
      socket.current?.close()
    }
  }, [])

  return { room, self, connected, error, setError, send }
}
