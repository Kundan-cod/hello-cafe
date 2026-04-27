'use client'

import { useEffect, useState } from 'react'
import Modal from '@/components/ui/Modal'

type DialogKind = 'confirm' | 'alert'

export type AppDialogOptions = {
  title?: string
  message: React.ReactNode
  confirmText?: string
  cancelText?: string
  destructive?: boolean
}

type DialogState =
  | null
  | ({
      kind: DialogKind
      options: AppDialogOptions
    } & { id: string })

let dialogListeners: ((state: DialogState) => void)[] = []
let dialogState: DialogState = null

let resolveConfirm: ((value: boolean) => void) | null = null
let resolveAlert: (() => void) | null = null

function setDialog(next: DialogState) {
  dialogState = next
  dialogListeners.forEach((l) => l(dialogState))
}

function closeDialog() {
  setDialog(null)
  resolveConfirm = null
  resolveAlert = null
}

export function appConfirm(options: AppDialogOptions): Promise<boolean> {
  const id = Math.random().toString(36).slice(2)

  return new Promise<boolean>((resolve) => {
    resolveConfirm = (value) => {
      resolve(value)
      closeDialog()
    }
    resolveAlert = null
    setDialog({ id, kind: 'confirm', options })
  })
}

export function appAlert(options: AppDialogOptions): Promise<void> {
  const id = Math.random().toString(36).slice(2)

  return new Promise<void>((resolve) => {
    resolveAlert = () => {
      resolve()
      closeDialog()
    }
    resolveConfirm = null
    setDialog({ id, kind: 'alert', options })
  })
}

export function useAppDialog() {
  const [state, setState] = useState<DialogState>(null)

  useEffect(() => {
    dialogListeners.push(setState)
    setState(dialogState)
    return () => {
      dialogListeners = dialogListeners.filter((l) => l !== setState)
    }
  }, [])

  return state
}

export default function AppDialogContainer() {
  const state = useAppDialog()

  if (!state) return null

  const { kind, options } = state
  const title = options.title ?? (kind === 'confirm' ? 'Confirm' : 'Message')

  const cancelText = options.cancelText ?? 'Cancel'
  const confirmText =
    options.confirmText ?? (kind === 'confirm' ? 'Confirm' : 'OK')

  const confirmClass = options.destructive
    ? 'bg-red-700 text-white hover:bg-red-800 active:bg-red-900'
    : 'bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800'

  const handleCancel = () => {
    if (kind === 'confirm') resolveConfirm?.(false)
    else resolveAlert?.()
  }

  const handleConfirm = () => {
    if (kind === 'confirm') resolveConfirm?.(true)
    else resolveAlert?.()
  }

  return (
    <Modal isOpen={true} onClose={handleCancel} title={title}>
      <div className="space-y-5">
        <div className="text-sm text-gray-700 whitespace-pre-line">
          {options.message}
        </div>

        <div className="flex justify-end gap-2 pt-2">
          {kind === 'confirm' && (
            <button
              type="button"
              onClick={handleCancel}
              className="min-h-[44px] px-4 py-2.5 rounded-lg border border-gray-300 bg-white text-gray-800 hover:bg-gray-50 active:bg-gray-100 font-medium"
            >
              {cancelText}
            </button>
          )}
          <button
            type="button"
            onClick={handleConfirm}
            className={`min-h-[44px] px-4 py-2.5 rounded-lg font-medium ${confirmClass}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </Modal>
  )
}

