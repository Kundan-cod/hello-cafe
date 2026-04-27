'use client'

import { useEffect } from 'react'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
}

export default function Modal({ isOpen, onClose, title, children }: ModalProps) {
  useEffect(() => {
    if (isOpen) {
      const scrollY = window.scrollY
      document.body.style.overflow = 'hidden'
      document.body.style.position = 'fixed'
      document.body.style.top = `-${scrollY}px`
      document.body.style.left = '0'
      document.body.style.right = '0'
      return () => {
        document.body.style.overflow = ''
        document.body.style.position = ''
        document.body.style.top = ''
        document.body.style.left = ''
        document.body.style.right = ''
        window.scrollTo(0, scrollY)
      }
    }
  }, [isOpen])

  if (!isOpen) return null

  const stopBackgroundScroll = (e: React.TouchEvent) => {
    if (e.target === e.currentTarget) e.preventDefault()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-hidden touch-none"
      style={{ paddingTop: 'max(1rem, var(--safe-area-inset-top))', paddingBottom: 'max(1rem, var(--safe-area-inset-bottom))' }}
      onClick={onClose}
      onTouchMove={stopBackgroundScroll}
    >
      <div
        className="bg-white w-full max-w-md flex flex-col rounded-xl shadow-xl max-h-[90dvh] touch-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-gray-200 shrink-0 bg-white rounded-t-xl">
          <h2 className="text-lg sm:text-xl font-bold text-gray-900 truncate pr-2">{title}</h2>
          <button
            onClick={onClose}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center -mr-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full text-2xl transition-colors"
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <div
          className="modal-form flex-1 min-h-0 overflow-y-auto p-4 pt-4 pb-[max(5rem,calc(5rem+env(safe-area-inset-bottom)))]"
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          {children}
        </div>
      </div>
    </div>
  )
}
