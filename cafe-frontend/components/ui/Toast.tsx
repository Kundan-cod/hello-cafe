'use client'

import { useEffect, useState } from 'react'

export type ToastType = 'success' | 'error' | 'info'

interface Toast {
  id: string
  message: string
  type: ToastType
}

let toastListeners: ((toasts: Toast[]) => void)[] = []
let toasts: Toast[] = []

function addToast(message: string, type: ToastType = 'info') {
  const id = Math.random().toString(36).substring(7)
  toasts = [...toasts, { id, message, type }]
  toastListeners.forEach((listener) => listener(toasts))

  setTimeout(() => {
    removeToast(id)
  }, 3000)
}

function removeToast(id: string) {
  toasts = toasts.filter((t) => t.id !== id)
  toastListeners.forEach((listener) => listener(toasts))
}

export function showToast(message: string, type: ToastType = 'info') {
  addToast(message, type)
}

export function useToast() {
  const [toastList, setToastList] = useState<Toast[]>([])

  useEffect(() => {
    toastListeners.push(setToastList)
    setToastList(toasts)

    return () => {
      toastListeners = toastListeners.filter((l) => l !== setToastList)
    }
  }, [])

  return toastList
}

export default function ToastContainer() {
  const toasts = useToast()

  if (toasts.length === 0) return null

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`min-w-[300px] p-4 rounded-lg shadow-lg ${
            toast.type === 'success'
              ? 'bg-green-500 text-white'
              : toast.type === 'error'
              ? 'bg-red-500 text-white'
              : 'bg-blue-500 text-white'
          }`}
        >
          <p>{toast.message}</p>
        </div>
      ))}
    </div>
  )
}
