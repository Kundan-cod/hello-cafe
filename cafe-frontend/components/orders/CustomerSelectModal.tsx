'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { showToast } from '@/components/ui/Toast'
import Modal from '@/components/ui/Modal'
import { customersApi } from '@/lib/api'
import { db } from '@/lib/db'

interface Customer {
  id: string
  name: string
  phone?: string | null
  email?: string | null
  address?: string | null
}

interface CustomerSelectModalProps {
  isOpen: boolean
  onClose: () => void
  onSelect: (customer: { name: string; phone: string; address: string }) => void
}

export default function CustomerSelectModal({
  isOpen,
  onClose,
  onSelect,
}: CustomerSelectModalProps) {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [loading, setLoading] = useState(false)
  const [suggestionHighlight, setSuggestionHighlight] = useState(-1)
  const [showSuggestions, setShowSuggestions] = useState(true)
  const phoneInputRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (isOpen) {
      loadCustomers()
      setName('')
      setPhone('')
      setAddress('')
      setSuggestionHighlight(-1)
      setShowSuggestions(true)
      setTimeout(() => phoneInputRef.current?.focus(), 100)
    }
  }, [isOpen])

  useEffect(() => {
    if (isOpen) {
      void loadCustomers()
    }
  }, [isOpen])

  const loadCustomers = async () => {
    try {
      setLoading(true)
      // Show cached customers instantly
      try {
        const cached = await db.customers.where('type').equals('CUSTOMER').toArray()
        if (cached.length > 0) setCustomers(cached)
      } catch {}
      const data = await customersApi.getCustomers('CUSTOMER')
      setCustomers(data || [])
    } catch (error: any) {
      showToast(error.message || 'Failed to load customers', 'error')
    } finally {
      setLoading(false)
    }
  }

  const suggestions = useMemo(() => {
    const phoneQ = phone.trim().replace(/\D/g, '')
    if (phoneQ.length < 2) return []
    return customers.filter((c) =>
      c.phone?.replace(/\D/g, '').includes(phoneQ)
    )
  }, [customers, phone])

  const applySuggestion = (c: Customer) => {
    const phoneVal = c.phone?.trim() || ''
    const addressVal = c.address?.trim() || ''
    if (!phoneVal || !addressVal) {
      showToast('This customer is missing phone or address. Please enter manually.', 'error')
      return
    }
    setName(c.name)
    setPhone(phoneVal)
    setAddress(addressVal)
    setSuggestionHighlight(-1)
    setShowSuggestions(false)
  }

  const handleSubmit = async () => {
    if (!name.trim()) {
      showToast('Enter customer name', 'error')
      return
    }
    if (!phone.trim()) {
      showToast('Enter phone number', 'error')
      return
    }
    if (!address.trim()) {
      showToast('Enter delivery address', 'error')
      return
    }
    const existing = customers.find(
      (c) =>
        c.name.trim().toLowerCase() === name.trim().toLowerCase() &&
        (c.phone?.trim() === phone.trim() || c.phone?.replace(/\D/g, '') === phone.replace(/\D/g, ''))
    )
    if (existing) {
      const addr = existing.address?.trim()
      if (!addr) {
        showToast('This customer has no address saved. Enter address below.', 'error')
        return
      }
      onSelect({ name: existing.name, phone: existing.phone!, address: addr })
    } else {
      try {
        await customersApi.createCustomer({
          name: name.trim(),
          phone: phone.trim(),
          address: address.trim(),
          type: 'CUSTOMER',
        })
      } catch {
        // If create fails (e.g. duplicate), still use the entered data for this order
      }
      onSelect({
        name: name.trim(),
        phone: phone.trim(),
        address: address.trim(),
      })
    }
    onClose()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (suggestions.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSuggestionHighlight((i) => (i < suggestions.length - 1 ? i + 1 : 0))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSuggestionHighlight((i) => (i > 0 ? i - 1 : suggestions.length - 1))
    } else if (e.key === 'Enter' && suggestionHighlight >= 0) {
      e.preventDefault()
      applySuggestion(suggestions[suggestionHighlight])
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Customer Detail">
      <div className="space-y-4">
        {/* Contact Number first - with suggestions dropdown directly below */}
        <div className="relative">
          <label className="block text-sm font-medium text-gray-700 mb-1">Contact Number *</label>
          <input
            ref={phoneInputRef}
            type="tel"
            value={phone}
            onChange={(e) => {
              setPhone(e.target.value)
              setSuggestionHighlight(-1)
              setShowSuggestions(true)
            }}
            onKeyDown={handleKeyDown}
            placeholder="Enter contact number"
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-gray-600 placeholder:text-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          {suggestions.length > 0 && showSuggestions && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg overflow-y-auto max-h-48 z-10">
              {suggestions.map((c, i) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => applySuggestion(c)}
                  className={`w-full text-left px-4 py-3 hover:bg-gray-50 flex flex-col gap-0.5 ${
                    i === suggestionHighlight ? 'bg-blue-50' : ''
                  }`}
                >
                  <span className="font-medium text-gray-900">{c.name}</span>
                  {c.phone && <span className="text-sm text-gray-600">{c.phone}</span>}
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Customer Name *</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter customer name"
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-gray-600 placeholder:text-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Address *</label>
          <textarea
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Enter the address"
            rows={3}
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-gray-600 placeholder:text-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {loading && (
          <p className="text-sm text-gray-500">Loading customers...</p>
        )}

        <button
          onClick={handleSubmit}
          className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700"
        >
          Use Customer
        </button>
      </div>
    </Modal>
  )
}
