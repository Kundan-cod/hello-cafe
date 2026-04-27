'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

export default function Navbar() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)

  useEffect(() => {
    setIsAuthenticated(!!(typeof window !== 'undefined' && localStorage.getItem('token')))
  }, [])

  const navLink =
    'text-slate-600 hover:text-red-700 font-medium transition-colors'

  return (
    <header className="w-full px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between bg-white/95 backdrop-blur shadow-sm sticky top-0 z-50">
      <Link href="/" className="text-red-800 font-bold text-xl tracking-tight" prefetch>
        Hello Cafe
      </Link>

      <nav className="hidden md:flex items-center gap-6 lg:gap-8">
        <Link href="/#about" className={navLink} prefetch>
          About
        </Link>
        <Link href="/#features" className={navLink} prefetch>
          Features
        </Link>
        <Link href="/#pricing" className={navLink} prefetch>
          Pricing
        </Link>
        <Link href="/#learning" className={navLink} prefetch>
          Learning Center
        </Link>
        <Link href="/#contact" className={navLink} prefetch>
          Contact Us
        </Link>
      </nav>

      <div className="flex items-center gap-2 sm:gap-3">
        <Link
          href="/login"
          className="px-5 py-2 rounded-full bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition"
          prefetch
        >
          Login
        </Link>
      </div>
    </header>
  )
}
