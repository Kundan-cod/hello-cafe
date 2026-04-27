/**
 * Nepal districts by province (77 districts across 7 provinces).
 * Keys support both register page (province-1..7) and branches page (Province 1, Madhesh, etc.).
 */
const P1 = ['Bhojpur', 'Dhankuta', 'Ilam', 'Jhapa', 'Khotang', 'Morang', 'Okhaldhunga', 'Panchthar', 'Sankhuwasabha', 'Solukhumbu', 'Sunsari', 'Taplejung', 'Tehrathum', 'Udayapur']
const P2 = ['Bara', 'Dhanusha', 'Mahottari', 'Parsa', 'Rautahat', 'Saptari', 'Sarlahi', 'Siraha']
const P3 = ['Bhaktapur', 'Chitwan', 'Dhading', 'Dolakha', 'Kathmandu', 'Kavrepalanchok', 'Lalitpur', 'Makwanpur', 'Nuwakot', 'Ramechhap', 'Rasuwa', 'Sindhuli', 'Sindhupalchok']
const P4 = ['Baglung', 'Gorkha', 'Kaski', 'Lamjung', 'Manang', 'Mustang', 'Myagdi', 'Nawalpur', 'Parbat', 'Syangja', 'Tanahun']
const P5 = ['Arghakhanchi', 'Banke', 'Bardiya', 'Dang', 'Eastern Rukum', 'Gulmi', 'Kapilvastu', 'Palpa', 'Parasi', 'Pyuthan', 'Rolpa', 'Rupandehi']
const P6 = ['Dailekh', 'Dolpa', 'Humla', 'Jajarkot', 'Jumla', 'Kalikot', 'Mugu', 'Salyan', 'Surkhet', 'Western Rukum']
const P7 = ['Achham', 'Baitadi', 'Bajhang', 'Bajura', 'Dadeldhura', 'Darchula', 'Doti', 'Kailali', 'Kanchanpur']

export const DISTRICTS_BY_PROVINCE: Record<string, string[]> = {
  'province-1': P1,
  'Province 1': P1,
  'province-2': P2,
  'Madhesh': P2,
  'province-3': P3,
  'Bagmati': P3,
  'province-4': P4,
  'Gandaki': P4,
  'province-5': P5,
  'Lumbini': P5,
  'province-6': P6,
  'Karnali': P6,
  'province-7': P7,
  'Sudurpashchim': P7,
  'Other': ['Other'],
}
