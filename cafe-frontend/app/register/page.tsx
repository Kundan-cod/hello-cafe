'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { authApi, ApiError } from '@/lib/api'
import { saveAuth } from '@/lib/auth-storage'
import { DISTRICTS_BY_PROVINCE } from '@/lib/provinces-districts'
import { showToast } from '@/components/ui/Toast'

type Step = 'account' | 'confirm-trial' | 'setup-cafe'

function isValidEmail(email: string): boolean {
  const value = email.trim().toLowerCase()
  // Basic but robust-enough email format check.
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

function isStrongPassword(password: string): boolean {
  // Minimum 6 characters, any characters allowed.
  return typeof password === 'string' && password.length >= 6
}

export default function RegisterPage() {
  const router = useRouter()

  const [step, setStep] = useState<Step>('account')
  const [loading, setLoading] = useState(false)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const [cafeDetails, setCafeDetails] = useState({
    cafeName: '',
    ownerName: '',
    contactNumber: '',
    province: '',
    district: '',
    location: '',
    brandPrimaryColor: '#3B4DA1',
    brandSecondaryColor: '#CB2424',
    orderManagementType: 'TABLE_BASED',
    panNumber: '',
  })

  const planType: 'TRIAL' = 'TRIAL'
  const handleAccountSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (loading) return

    if (!isValidEmail(email)) {
      showToast('Please enter a valid email address', 'error')
      return
    }

    if (!isStrongPassword(password)) {
      showToast('Password must be at least 6 characters.', 'error')
      return
    }

    if (password !== confirmPassword) {
      showToast('Passwords do not match', 'error')
      return
    }

    setStep('confirm-trial')
  }

  const handleConfirmTrial = (e: React.FormEvent) => {
    e.preventDefault()
    if (loading) return
    setStep('setup-cafe')
  }

  const handleSetupCafe = async (e: React.FormEvent) => {
    e.preventDefault()
    if (loading) return

    if (!cafeDetails.cafeName || !cafeDetails.contactNumber || !cafeDetails.province || !cafeDetails.district || !cafeDetails.location || !cafeDetails.panNumber) {
      showToast('Please fill all required fields', 'error')
      return
    }

    if (!isValidEmail(email)) {
      showToast('Email is not valid. Please restart registration.', 'error')
      return
    }

    if (!isStrongPassword(password)) {
      showToast('Password must be at least 6 characters.', 'error')
      return
    }

    if (password !== confirmPassword) {
      showToast('Passwords do not match', 'error')
      return
    }

    const normalizedEmail = email.trim().toLowerCase()

    setLoading(true)
    try {
      const response = await authApi.register({
        cafeName: cafeDetails.cafeName,
        name: cafeDetails.ownerName || cafeDetails.cafeName,
        email: normalizedEmail,
        password,
        contactNumber: cafeDetails.contactNumber,
        province: cafeDetails.province,
        district: cafeDetails.district,
        location: cafeDetails.location,
        brandPrimaryColor: cafeDetails.brandPrimaryColor,
        brandSecondaryColor: cafeDetails.brandSecondaryColor,
        orderManagementType: cafeDetails.orderManagementType,
        panNumber: cafeDetails.panNumber,
        planType,
      })

      saveAuth(response.access_token, response.tenantId, JSON.stringify(response.user), {
        role: response.role,
        branchId: response.branchId ?? null,
        mustChangePassword: response.mustChangePassword ?? false,
      })

      showToast('Cafe set up successfully!', 'success')
      // After registration, send user to dashboard
      router.push('/profile')
    } catch (error: any) {
      if (error instanceof ApiError) {
        if (error.status === 400) {
          // Covers: email already in use, OTP not verified, weak password
          showToast(error.message, 'error')
        } else if (error.status >= 500) {
          showToast('Server error. Please try again later.', 'error')
        } else {
          showToast(error.message || 'Failed to set up cafe', 'error')
        }
      } else {
        showToast('Failed to set up cafe. Please check your connection and try again.', 'error')
      }
    } finally {
      setLoading(false)
    }
  }

  const renderStep = () => {
    if (step === 'account') {
      return (
        <form onSubmit={handleAccountSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-600 placeholder:text-gray-600 focus:ring-2 focus:ring-red-700 focus:border-transparent"
              placeholder="Enter your email address"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={6}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-600 placeholder:text-gray-400 focus:ring-2 focus:ring-red-700 focus:border-transparent"
              placeholder="Enter password"
            />
            <p className="mt-1 text-xs text-gray-500">
              Minimum 6 characters.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Confirm password
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              minLength={6}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-600 placeholder:text-gray-400 focus:ring-2 focus:ring-red-700 focus:border-transparent"
              placeholder="Enter confirm password"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-red-700 text-white py-2 rounded-lg font-medium hover:bg-red-800 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Continuing...' : 'Continue'}
          </button>
        </form>
      )
    }

    if (step === 'confirm-trial') {
      return (
        <form onSubmit={handleConfirmTrial} className="space-y-4">
          <div className="rounded-lg border border-gray-200 p-4 bg-slate-50">
            <h2 className="text-lg font-semibold text-gray-900 mb-1">Trial plan</h2>
            <p className="text-sm text-gray-600 mb-2">
              You are starting a free trial. No payment will be charged today.
            </p>
            <p className="text-2xl font-bold text-red-700">Rs. 0</p>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-red-700 text-white py-2 rounded-lg font-medium hover:bg-red-800 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Confirm payment &amp; continue
          </button>
        </form>
      )
    }

    // setup-cafe
    return (
      <form onSubmit={handleSetupCafe} className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Cafe Name<span className="text-red-600">*</span>
          </label>
          <input
            type="text"
            value={cafeDetails.cafeName}
            onChange={(e) => setCafeDetails({ ...cafeDetails, cafeName: e.target.value })}
            required
            className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-600 placeholder:text-gray-600 focus:ring-2 focus:ring-red-700 focus:border-transparent"
            placeholder="Enter the cafe name"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Contact Number<span className="text-red-600">*</span>
          </label>
          <input
            type="tel"
            value={cafeDetails.contactNumber}
            onChange={(e) => setCafeDetails({ ...cafeDetails, contactNumber: e.target.value })}
            required
            className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-600 placeholder:text-gray-600 focus:ring-2 focus:ring-red-700 focus:border-transparent"
            placeholder="Enter the contact number"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Province<span className="text-red-600">*</span>
            </label>
            <select
              value={cafeDetails.province}
              onChange={(e) => setCafeDetails({ ...cafeDetails, province: e.target.value, district: '' })}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-600 bg-white focus:ring-2 focus:ring-red-700 focus:border-transparent"
            >
              <option value="">Select your province</option>
              <option value="province-1">Province 1</option>
              <option value="province-2">Province 2</option>
              <option value="province-3">Province 3</option>
              <option value="province-4">Province 4</option>
              <option value="province-5">Province 5</option>
              <option value="province-6">Province 6</option>
              <option value="province-7">Province 7</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              District<span className="text-red-600">*</span>
            </label>
            <select
              value={cafeDetails.district}
              onChange={(e) => setCafeDetails({ ...cafeDetails, district: e.target.value })}
              required
              disabled={!cafeDetails.province}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-600 bg-white focus:ring-2 focus:ring-red-700 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
            >
              <option value="">
                {cafeDetails.province ? 'Select your district' : 'Select province first'}
              </option>
              {(DISTRICTS_BY_PROVINCE[cafeDetails.province] || []).map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Location<span className="text-red-600">*</span>
          </label>
          <input
            type="text"
            value={cafeDetails.location}
            onChange={(e) => setCafeDetails({ ...cafeDetails, location: e.target.value })}
            required
            className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-600 placeholder:text-gray-600 focus:ring-2 focus:ring-red-700 focus:border-transparent"
            placeholder="Enter the cafe location"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Email ID
          </label>
          <input
            type="email"
            value={email}
            readOnly
            className="w-full px-4 py-2 border border-gray-200 bg-gray-50 rounded-lg text-gray-500"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Brand Primary Color <span className="text-gray-400 text-xs">(optional)</span>
            </label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={cafeDetails.brandPrimaryColor}
                onChange={(e) =>
                  setCafeDetails({ ...cafeDetails, brandPrimaryColor: e.target.value })
                }
                className="h-10 w-16 rounded border border-gray-300 cursor-pointer"
              />
              <input
                type="text"
                value={cafeDetails.brandPrimaryColor}
                onChange={(e) =>
                  setCafeDetails({ ...cafeDetails, brandPrimaryColor: e.target.value })
                }
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-gray-600 placeholder:text-gray-600 focus:ring-2 focus:ring-red-700 focus:border-transparent"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Brand Secondary Color <span className="text-gray-400 text-xs">(optional)</span>
            </label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={cafeDetails.brandSecondaryColor}
                onChange={(e) =>
                  setCafeDetails({ ...cafeDetails, brandSecondaryColor: e.target.value })
                }
                className="h-10 w-16 rounded border border-gray-300 cursor-pointer"
              />
              <input
                type="text"
                value={cafeDetails.brandSecondaryColor}
                onChange={(e) =>
                  setCafeDetails({ ...cafeDetails, brandSecondaryColor: e.target.value })
                }
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-gray-600 placeholder:text-gray-600 focus:ring-2 focus:ring-red-700 focus:border-transparent"
              />
            </div>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Order Management Type<span className="text-red-600">*</span>
          </label>
          <select
            value={cafeDetails.orderManagementType}
            onChange={(e) =>
              setCafeDetails({ ...cafeDetails, orderManagementType: e.target.value })
            }
            className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-600 bg-white focus:ring-2 focus:ring-red-700 focus:border-transparent"
          >
            <option value="TABLE_BASED">Table Based</option>
            <option value="COUNTER_BASED">Counter Based</option>
            <option value="BOTH">Both</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            PAN Number<span className="text-red-600">*</span>
          </label>
          <input
            type="text"
            value={cafeDetails.panNumber}
            onChange={(e) => setCafeDetails({ ...cafeDetails, panNumber: e.target.value })}
            required
            className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-600 placeholder:text-gray-600 focus:ring-2 focus:ring-red-700 focus:border-transparent"
            placeholder="Enter PAN number"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Cafe Logo <span className="text-gray-400 text-xs">(optional)</span>
          </label>
          <div className="border border-dashed border-gray-300 rounded-lg p-6 flex flex-col items-center justify-center gap-2">
            <button
              type="button"
              className="h-12 w-40 rounded-full border border-red-200 text-red-700 text-sm font-medium hover:bg-red-50"
            >
              + Upload Image
            </button>
            <p className="text-xs text-gray-500">
              Logo upload UI only. Wire to backend when available.
            </p>
          </div>
        </div>

        <p className="text-xs text-red-600">
          Important: Order type can only be set once. To change it later, you&apos;ll need to upgrade your plan.
        </p>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-red-700 text-white py-2 rounded-lg font-medium hover:bg-red-800 disabled:opacity-50 disabled:cursor-not-allowed mt-2"
        >
          {loading ? 'Setting up cafe...' : 'Set Up Cafe'}
        </button>
      </form>
    )
  }

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-lg p-6 md:p-8 w-full max-w-2xl">
        <h1 className="text-3xl font-bold text-red-700 mb-1 text-center">Set Up Your Cafe</h1>
        <p className="text-gray-600 mb-6 text-center">
          {step === 'account' &&
            'Create your account to start a 15-day free trial.'}
          {step === 'confirm-trial' &&
            'Confirm your 15-day free trial and continue to cafe setup.'}
          {step === 'setup-cafe' &&
            'Enter your cafe details to finish setting up.'}
        </p>

        <div className="mb-6 flex items-center justify-center gap-2 text-xs font-medium text-gray-500">
          <span className={step === 'account' ? 'text-red-700' : ''}>1. Create account</span>
          <span>›</span>
          <span className={step === 'confirm-trial' ? 'text-red-700' : ''}>2. Confirm trial</span>
          <span>›</span>
          <span className={step === 'setup-cafe' ? 'text-red-700' : ''}>3. Set up cafe</span>
        </div>

        {renderStep()}

        <p className="mt-6 text-center text-sm text-gray-600">
          Already have an account?{' '}
          <a href="/login" className="text-red-700 hover:underline">
            Sign in
          </a>
        </p>
      </div>
    </div>
  )
}
