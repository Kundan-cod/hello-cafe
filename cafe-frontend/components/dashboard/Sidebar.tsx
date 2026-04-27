'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { clearAuth } from '@/lib/auth-storage'

const STAFF_PATHS = ['/staff', '/staff/attendance']
const MENU_PATHS = ['/menu', '/menu/items', '/menu/menus', '/menu/combo']
const TABLES_PATHS = ['/tables', '/areas']

/** Sync role (and branchId) from JWT into localStorage if missing (e.g. old session). */
function ensureRoleFromToken(): string | null {
  if (typeof window === 'undefined') return null
  let role = localStorage.getItem('role')
  if (role) return role
  const token = localStorage.getItem('token')
  if (!token) return null
  try {
    const payload = JSON.parse(atob(token.split('.')[1]))
    if (payload.role) {
      localStorage.setItem('role', payload.role)
      if (payload.branchId != null) localStorage.setItem('branchId', payload.branchId)
      else localStorage.removeItem('branchId')
      return payload.role
    }
  } catch {
    // ignore invalid token
  }
  return null
}

interface SidebarProps {
  isOpen?: boolean
  onClose?: () => void
}

export default function Sidebar({ isOpen = false, onClose }: SidebarProps) {
  const pathname = usePathname()
  const [openDropdown, setOpenDropdown] = useState<string | null>(null)
  const [role, setRole] = useState<string | null>(null)

  useEffect(() => {
    setRole(ensureRoleFromToken())
  }, [pathname])

  useEffect(() => {
    if (STAFF_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'))) {
      setOpenDropdown('staff')
    } else if (MENU_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'))) {
      setOpenDropdown('menu')
    } else if (TABLES_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'))) {
      setOpenDropdown('tables')
    }
  }, [pathname])

  const openMenu = (key: string) => {
    setOpenDropdown((prev) => (prev === key ? null : key))
  }

  const handleItemClick = () => {
    setOpenDropdown(null)
    onClose?.()
  }

  return (
    <>
      {/* Sidebar: overlay on mobile/tablet, static on lg+ */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-40 w-72 sm:w-64 bg-white border-r border-gray-200 flex flex-col h-screen transform transition-transform duration-300 ease-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <nav className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-3 py-3 pt-4 space-y-1 text-sm">
          {role !== 'STAFF' && (
            <SidebarItem
              label="Dashboard"
              href="/dashboard"
              pathname={pathname}
              onItemClick={handleItemClick}
            />
          )}

          {role !== 'STAFF' && (
          <SidebarDropdown
            label="Staff Management"
            open={openDropdown === 'staff'}
            onClick={() => openMenu('staff')}
            onItemClick={handleItemClick}
            pathname={pathname}
            items={[
              { label: 'Staff Management', href: '/staff' },
              { label: 'Staff Attendance', href: '/staff/attendance' },
            ]}
          />
          )}

          {role !== 'STAFF' && (
          <SidebarDropdown
            label="Menu & Category"
            open={openDropdown === 'menu'}
            onClick={() => openMenu('menu')}
            onItemClick={handleItemClick}
            pathname={pathname}
            items={[
              { label: 'Category', href: '/menu' },
              { label: 'Menu Items', href: '/menu/items' },
              { label: 'Menus', href: '/menu/menus' },
              { label: 'Combo', href: '/menu/combo' },
            ]}
          />
          )}

          {role !== 'STAFF' && (
          <SidebarDropdown
            label="Tables & Areas"
            open={openDropdown === 'tables'}
            onClick={() => openMenu('tables')}
            onItemClick={handleItemClick}
            pathname={pathname}
            items={[
              { label: 'Manage Tables', href: '/tables' },
              { label: 'Manage Areas', href: '/areas' },
            ]}
          />
          )}

          <SidebarItem
            label="Order Management"
            href="/orders"
            pathname={pathname}
            onItemClick={handleItemClick}
          />
          {role !== 'STAFF' && (
          <SidebarItem
            label="Discount & Offers"
            href="/discounts"
            pathname={pathname}
            onItemClick={handleItemClick}
          />
          )}
          {role !== 'STAFF' && (
          <SidebarItem
            label="Billing & Subscription"
            href="/billing"
            pathname={pathname}
            onItemClick={handleItemClick}
          />
          )}
          {role === 'OWNER' && (
            <SidebarItem
              label="Branches"
              href="/branches"
              pathname={pathname}
              onItemClick={handleItemClick}
            />
          )}
          {role !== 'STAFF' && (
          <SidebarItem
            label="Customers & Creditors"
            href="/customers"
            pathname={pathname}
            onItemClick={handleItemClick}
          />
          )}
          {role !== 'STAFF' && (
          <SidebarItem
            label="Vendors"
            href="/vendors"
            pathname={pathname}
            onItemClick={handleItemClick}
          />
          )}
          {role !== 'STAFF' && (
          <SidebarItem
            label="Inventory"
            href="/inventory"
            pathname={pathname}
            onItemClick={handleItemClick}
          />
          )}
          {role !== 'STAFF' && (
          <SidebarItem
            label="Reports"
            href="/reports"
            pathname={pathname}
            onItemClick={handleItemClick}
          />
          )}
          <SidebarItem
            label="Settings"
            href="/settings"
            pathname={pathname}
            onItemClick={handleItemClick}
          />
        </nav>

        {/* Logout button */}
        <div className="flex-shrink-0 p-3 border-t border-gray-100">
          <button
            onClick={async () => {
              await clearAuth()
              window.location.href = '/login'
            }}
            className="w-full min-h-[44px] px-3 py-2.5 rounded-md bg-red-50 text-red-700 hover:bg-red-100 active:bg-red-200 font-medium"
          >
            Logout
          </button>
        </div>
      </aside>

      {/* Mobile/tablet overlay when drawer open */}
      {isOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-30"
          onClick={onClose}
          aria-hidden
        />
      )}
    </>
  )
}

function SidebarItem({
  label,
  href,
  pathname,
  onItemClick,
}: {
  label: string
  href?: string
  pathname: string
  onItemClick?: () => void
}) {
  const isActive =
    href &&
    href !== '#' &&
    (pathname === href || (pathname.startsWith(href + '/') && href !== '/'))
  const content = (
    <div
      className={`px-3 py-2.5 min-h-[44px] flex items-center rounded-md font-medium ${
        isActive
          ? 'bg-red-700 text-white'
          : 'hover:bg-slate-100 cursor-pointer text-gray-800'
      }`}
    >
      {label}
    </div>
  )

  if (href && href !== '#') {
    return (
      <Link href={href} onClick={onItemClick} prefetch>
        {content}
      </Link>
    )
  }

  return content
}

function SidebarDropdown({
  label,
  open,
  onClick,
  onItemClick,
  pathname,
  items,
}: {
  label: string
  open: boolean
  onClick: () => void
  onItemClick?: () => void
  pathname: string
  items: { label: string; href: string }[]
}) {
  return (
    <div>
      <div
        onClick={onClick}
        className="px-3 py-2.5 min-h-[44px] rounded-md cursor-pointer flex justify-between items-center font-medium text-gray-800 hover:bg-slate-100 active:bg-slate-200"
      >
        <span>{label}</span>
        <svg
          className={`w-4 h-4 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </div>

      {open && (
        <div className="ml-4 mt-1 space-y-1">
          {items.map((item) => {
            const isActive = pathname === item.href
            return (
              <Link
                key={item.label}
                href={item.href}
                onClick={onItemClick}
                prefetch
                className={`block px-3 py-2.5 min-h-[44px] flex items-center rounded-md font-medium ${
                  isActive
                    ? 'bg-red-700 text-white'
                    : 'hover:bg-slate-100 text-gray-700 active:bg-slate-200'
                }`}
              >
                {item.label}
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
