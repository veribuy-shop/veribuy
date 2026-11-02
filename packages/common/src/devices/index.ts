/** Brands offered for each device type when listing, shared by the web and mobile forms. */
export const DEVICE_BRANDS: Record<string, string[]> = {
  SMARTPHONE: ['Apple', 'Samsung', 'Google', 'OnePlus', 'Xiaomi', 'Motorola', 'Other'],
  TABLET: ['Apple', 'Samsung', 'Microsoft', 'Lenovo', 'Amazon', 'Other'],
  LAPTOP: ['Apple', 'Dell', 'HP', 'Lenovo', 'Asus', 'Acer', 'Microsoft', 'Other'],
  SMARTWATCH: ['Apple', 'Samsung', 'Garmin', 'Fitbit', 'Other'],
  AIRPODS: ['Apple', 'Other'],
  DESKTOP: ['Apple', 'Dell', 'HP', 'Lenovo', 'Asus', 'Acer', 'Other'],
  GAMING_CONSOLE: ['Sony', 'Microsoft', 'Nintendo', 'Valve', 'Other'],
  OTHER: ['Other'],
};
