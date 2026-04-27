'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Navbar from '../components/Navbar'
import Hero from '../components/Hero'
import LandingFeatures from '../components/LandingFeatures'
import Pricing from '../components/Pricing'
import { getAuthSync } from '@/lib/auth-storage'

export default function Page() {
  const router = useRouter()

  useEffect(() => {
    // Redirect authenticated users away from landing page
    const auth = getAuthSync()
    if (auth) {
      const role = auth.role
      if (role === 'STAFF') {
        router.replace('/orders')
      } else {
        router.replace('/dashboard')
      }
    }
  }, [router])

  return (
    <main className="min-h-screen bg-white">
      <Navbar />
      <Hero />

      <LandingFeatures />

      <Pricing />

      <section id="about" className="max-w-4xl mx-auto px-4 sm:px-6 py-16 sm:py-24 text-center">
        <h2 className="text-3xl font-bold text-slate-900 mb-6">About Hello Cafe</h2>
        <p className="text-slate-600 max-w-2xl mx-auto leading-relaxed">
          Hello Cafe is a cafe management system built to help you run orders,
          menus, inventory, and reports in one place. Whether you run a single outlet or multiple
          branches, Hello Cafe scales with you. Start with a free trial and see the difference.
        </p>
      </section>

      <section id="learning" className="max-w-4xl mx-auto px-4 sm:px-6 py-16 text-center">
        <h2 className="text-2xl font-bold text-slate-900 mb-4">Learning Center</h2>
        <p className="text-slate-600 max-w-xl mx-auto">
          Guides, tips, and best practices to get the most out of Hello Cafe. Coming soon.
        </p>
      </section>

      <section id="contact" className="max-w-4xl mx-auto px-4 sm:px-6 py-16 sm:py-20 text-center bg-slate-50 rounded-t-3xl">
        <h2 className="text-2xl font-bold text-slate-900 mb-4">Contact Us</h2>
        <p className="text-slate-600 mb-6">
          Questions or need help? We&apos;re here for you.
        </p>
        <a
          href="mailto:hello@hellocafe.com"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-red-600 text-white font-medium hover:bg-red-700 transition"
        >
          Get in touch
        </a>
      </section>

      <footer className="py-6 px-4 text-center text-sm text-slate-500 border-t border-slate-200">
        <p>© {new Date().getFullYear()} Hello Cafe. Cafe Management System.</p>
      </footer>
    </main>
  )
}
