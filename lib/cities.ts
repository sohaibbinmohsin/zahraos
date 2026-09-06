export interface CityOption {
  id: string;
  label: string;
  secondary?: string;
  aliases?: string[];
}

export const PAKISTAN_CITIES: CityOption[] = [
  { id: "lahore", label: "Lahore", secondary: "Punjab" },
  { id: "karachi", label: "Karachi", secondary: "Sindh" },
  { id: "islamabad", label: "Islamabad", secondary: "Federal Capital" },
  { id: "rawalpindi", label: "Rawalpindi", secondary: "Punjab" },
  { id: "faisalabad", label: "Faisalabad", secondary: "Punjab", aliases: ["Lyallpur"] },
  { id: "multan", label: "Multan", secondary: "Punjab" },
  { id: "peshawar", label: "Peshawar", secondary: "Khyber Pakhtunkhwa" },
  { id: "quetta", label: "Quetta", secondary: "Balochistan" },
  { id: "sialkot", label: "Sialkot", secondary: "Punjab" },
  { id: "gujranwala", label: "Gujranwala", secondary: "Punjab" },
  { id: "hyderabad", label: "Hyderabad", secondary: "Sindh" },
  { id: "abbottabad", label: "Abbottabad", secondary: "Khyber Pakhtunkhwa" },
  { id: "bahawalpur", label: "Bahawalpur", secondary: "Punjab" },
  { id: "sargodha", label: "Sargodha", secondary: "Punjab" },
  { id: "sukkur", label: "Sukkur", secondary: "Sindh" },
  { id: "larkana", label: "Larkana", secondary: "Sindh" },
  { id: "sheikhupura", label: "Sheikhupura", secondary: "Punjab" },
  { id: "jhang", label: "Jhang", secondary: "Punjab" },
  { id: "rahim_yar_khan", label: "Rahim Yar Khan", secondary: "Punjab", aliases: ["RYK"] },
  { id: "gujrat", label: "Gujrat", secondary: "Punjab" },
  { id: "mardan", label: "Mardan", secondary: "Khyber Pakhtunkhwa" },
  { id: "kasur", label: "Kasur", secondary: "Punjab" },
  { id: "sahiwal", label: "Sahiwal", secondary: "Punjab", aliases: ["Montgomery"] },
  { id: "okara", label: "Okara", secondary: "Punjab" },
  { id: "wah_cantt", label: "Wah Cantt", secondary: "Punjab", aliases: ["Wah"] },
  { id: "dera_ghazi_khan", label: "Dera Ghazi Khan", secondary: "Punjab", aliases: ["DG Khan"] },
  { id: "mirpur", label: "Mirpur", secondary: "Azad Kashmir" },
  { id: "muzaffarabad", label: "Muzaffarabad", secondary: "Azad Kashmir" },
  { id: "gilgit", label: "Gilgit", secondary: "Gilgit-Baltistan" },
  { id: "skardu", label: "Skardu", secondary: "Gilgit-Baltistan" },
  { id: "gwadar", label: "Gwadar", secondary: "Balochistan" },
  { id: "turbat", label: "Turbat", secondary: "Balochistan" },
  { id: "khuzdar", label: "Khuzdar", secondary: "Balochistan" },
  { id: "swat", label: "Swat", secondary: "Khyber Pakhtunkhwa", aliases: ["Mingora"] },
  { id: "dera_ismail_khan", label: "Dera Ismail Khan", secondary: "Khyber Pakhtunkhwa", aliases: ["DI Khan"] },
  { id: "kohat", label: "Kohat", secondary: "Khyber Pakhtunkhwa" },
  { id: "bannu", label: "Bannu", secondary: "Khyber Pakhtunkhwa" },
  { id: "chiniot", label: "Chiniot", secondary: "Punjab" },
  { id: "kamoke", label: "Kamoke", secondary: "Punjab" },
  { id: "hafizabad", label: "Hafizabad", secondary: "Punjab" },
  { id: "burewala", label: "Burewala", secondary: "Punjab" },
  { id: "khanewal", label: "Khanewal", secondary: "Punjab" },
  { id: "muzaffargarh", label: "Muzaffargarh", secondary: "Punjab" },
  { id: "mandi_bahauddin", label: "Mandi Bahauddin", secondary: "Punjab" },
  { id: "jhelum", label: "Jhelum", secondary: "Punjab" },
  { id: "chakwal", label: "Chakwal", secondary: "Punjab" },
  { id: "attock", label: "Attock", secondary: "Punjab" },
  { id: "vehari", label: "Vehari", secondary: "Punjab" },
  { id: "nawabshah", label: "Nawabshah", secondary: "Sindh", aliases: ["Shaheed Benazirabad"] },
  { id: "mirpur_khas", label: "Mirpur Khas", secondary: "Sindh" },
  { id: "jacobabad", label: "Jacobabad", secondary: "Sindh" },
  { id: "shikarpur", label: "Shikarpur", secondary: "Sindh" },
  { id: "khairpur", label: "Khairpur", secondary: "Sindh" },
  { id: "muridke", label: "Muridke", secondary: "Punjab" },
];

export function filterCities(query: string): CityOption[] {
  const q = query.trim().toLowerCase();
  if (!q) return PAKISTAN_CITIES;

  return PAKISTAN_CITIES.filter((city) => {
    if (city.label.toLowerCase().includes(q)) return true;
    if (city.secondary && city.secondary.toLowerCase().includes(q)) return true;
    if (city.aliases && city.aliases.some((a) => a.toLowerCase().includes(q))) return true;
    return false;
  });
}
