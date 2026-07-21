export type CountryCode = {
  name: string;
  code: string; // dial code, e.g. "+1"
  iso: string; // ISO 3166 alpha-2
};

export const COUNTRY_CODES: CountryCode[] = [
  { name: "United States", code: "+1", iso: "US" },
  { name: "Canada", code: "+1", iso: "CA" },
  { name: "United Kingdom", code: "+44", iso: "GB" },
  { name: "Spain", code: "+34", iso: "ES" },
  { name: "France", code: "+33", iso: "FR" },
  { name: "Germany", code: "+49", iso: "DE" },
  { name: "Italy", code: "+39", iso: "IT" },
  { name: "Portugal", code: "+351", iso: "PT" },
  { name: "Netherlands", code: "+31", iso: "NL" },
  { name: "Ireland", code: "+353", iso: "IE" },
  { name: "Mexico", code: "+52", iso: "MX" },
  { name: "Brazil", code: "+55", iso: "BR" },
  { name: "Argentina", code: "+54", iso: "AR" },
  { name: "Australia", code: "+61", iso: "AU" },
  { name: "New Zealand", code: "+64", iso: "NZ" },
  { name: "India", code: "+91", iso: "IN" },
  { name: "Pakistan", code: "+92", iso: "PK" },
  { name: "United Arab Emirates", code: "+971", iso: "AE" },
  { name: "Saudi Arabia", code: "+966", iso: "SA" },
  { name: "Egypt", code: "+20", iso: "EG" },
  { name: "South Africa", code: "+27", iso: "ZA" },
  { name: "Nigeria", code: "+234", iso: "NG" },
  { name: "Singapore", code: "+65", iso: "SG" },
  { name: "Japan", code: "+81", iso: "JP" },
  { name: "China", code: "+86", iso: "CN" },
  { name: "Hong Kong", code: "+852", iso: "HK" },
  { name: "Philippines", code: "+63", iso: "PH" },
  { name: "Indonesia", code: "+62", iso: "ID" },
  { name: "Russia", code: "+7", iso: "RU" },
  { name: "Turkey", code: "+90", iso: "TR" },
];
