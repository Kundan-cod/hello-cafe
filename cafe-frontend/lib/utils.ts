export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ')
}

export function formatCurrency(amount: number): string {
  return `Rs. ${amount.toLocaleString('en-IN')}`
}

export function formatDate(date: string | Date): string {
  return new Date(date).toLocaleDateString('en-IN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** Image to show for a menu item: item's image or its category's image. */
export function getItemDisplayImage(
  item: { imageUrl?: string | null },
  category?: { imageUrl?: string | null } | null
): string | null {
  const url = item?.imageUrl?.trim() || category?.imageUrl?.trim()
  return url || null
}
