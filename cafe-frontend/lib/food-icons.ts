/**
 * Food icon presets from public folder.
 * SVGs are B&W (fill:#010002) - we colorize at runtime.
 */
export const FOOD_ICON_PRESETS = [
  { id: 'coffee', label: 'Coffee', path: '/coffee-jar-svgrepo-com.svg', color: '#6F4E37' },
  { id: 'hot-coffee', label: 'Hot Coffee', path: '/hot-coffee-on-a-tall-paper-cup-svgrepo-com.svg', color: '#5D4037' },
  { id: 'burger', label: 'Burger', path: '/hamburger-with-sesame-seeds-svgrepo-com.svg', color: '#8B4513' },
  { id: 'dessert', label: 'Dessert', path: '/cupcake-dessert-svgrepo-com.svg', color: '#E91E63' },
  { id: 'ice-cream', label: 'Ice Cream', path: '/ice-cream-cone-svgrepo-com.svg', color: '#FF69B4' },
  { id: 'fries', label: 'Fries', path: '/french-fries-on-container-svgrepo-com.svg', color: '#FFD700' },
  { id: 'hot-dog', label: 'Hot Dog', path: '/hot-dog-with-sauce-and-bread-svgrepo-com.svg', color: '#CD853F' },
  { id: 'soup', label: 'Soup', path: '/hot-soup-svgrepo-com.svg', color: '#FF8C00' },
  { id: 'cocktail', label: 'Cocktail', path: '/cocktail-drink-with-stirrer-svgrepo-com.svg', color: '#E53935' },
  { id: 'chicken', label: 'Chicken', path: '/chicken-leg-svgrepo-com.svg', color: '#D2691E' },
  { id: 'cooking', label: 'Cooking', path: '/cooking-food-in-a-hot-casserole-svgrepo-com.svg', color: '#FF7043' },
  { id: 'meal', label: 'Meal', path: '/dining-meal-covered-svgrepo-com.svg', color: '#795548' },
  { id: 'carrot', label: 'Carrot', path: '/fresh-carrot-svgrepo-com.svg', color: '#FF8C00' },
  { id: 'fish', label: 'Fish', path: '/fish-tail-bone-svgrepo-com.svg', color: '#78909C' },
  { id: 'corn', label: 'Corn', path: '/corn-with-leaves-svgrepo-com.svg', color: '#FFB300' },
  { id: 'cheese', label: 'Cheese', path: '/cheese-with-little-cutted-triangular-piece-svgrepo-com.svg', color: '#FFCA28' },
  { id: 'avocado', label: 'Avocado', path: '/half-avocado-svgrepo-com.svg', color: '#689F38' },
  { id: 'lemon', label: 'Lemon', path: '/horizontal-lemon-svgrepo-com.svg', color: '#FFEB3B' },
  { id: 'apple', label: 'Apple', path: '/apple-with-stem-and-leaf-svgrepo-com.svg', color: '#E53935' },
  { id: 'grapes', label: 'Grapes', path: '/grapes-with-leaf-and-stem-svgrepo-com.svg', color: '#7B1FA2' },
  { id: 'bottle', label: 'Bottle', path: '/preserved-in-a-bottle-svgrepo-com.svg', color: '#43A047' },
  { id: 'combo', label: 'Combo', path: '/burger-and-soda-with-straw-svgrepo-com.svg', color: '#D84315' },
  { id: 'cupcake', label: 'Cupcake', path: '/paper-cupcake-svgrepo-com.svg', color: '#F06292' },
  { id: 'meat', label: 'Meat', path: '/meat-slice-svgrepo-com.svg', color: '#8D6E63' },
]

const svgUrlCache: Record<string, string> = {}

export async function getColoredSvgDataUrl(path: string, color: string): Promise<string> {
  const cacheKey = `${path}:${color}`
  if (svgUrlCache[cacheKey]) return svgUrlCache[cacheKey]
  const base = typeof window !== 'undefined' ? '' : process.env.NEXT_PUBLIC_APP_URL || ''
  const res = await fetch(`${base}${path}`)
  const svgText = await res.text()
  const colored = svgText.replace(/style="fill:#010002;?"/g, `style="fill:${color}"`)
  const dataUrl = `data:image/svg+xml,${encodeURIComponent(colored)}`
  svgUrlCache[cacheKey] = dataUrl
  return dataUrl
}
