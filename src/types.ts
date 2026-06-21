export interface Canton {
  code: string; // ZH, BE, TI, etc.
  name: string; // Italian version
  originalName: string; // e.g., Zürich, Genève
  capital: string;
  languages: string[]; // Tedesco, Francese, Italiano, Romancio
  population: number;
  area: number; // km²
  joinedConfederacy: number; // year
  color: string; // Tailwind class
  accentColor: string; // HEX color for visual highlights
}
