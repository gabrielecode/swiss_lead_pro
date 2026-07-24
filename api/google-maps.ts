export interface GoogleMapsLeadRaw {
  company: string;
  sector: string;
  address: string;
  phone: string;
  website: string;
  source: "google-maps";
  googleMapsUrl?: string;
  placeId?: string;
  categories?: string[];
}

interface GooglePlacesTextValue {
  text?: string;
}

interface GooglePlaceResult {
  id?: string;
  displayName?: GooglePlacesTextValue;
  formattedAddress?: string;
  nationalPhoneNumber?: string;
  websiteUri?: string;
  googleMapsUri?: string;
  primaryTypeDisplayName?: GooglePlacesTextValue;
  types?: string[];
  businessStatus?: string;
}

const GOOGLE_MAPS_ENDPOINT = "https://places.googleapis.com/v1/places:searchText";

const cleanText = (value?: string): string => String(value || "").replace(/\s+/g, " ").trim();

const slugToLabel = (value: string): string =>
  value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase())
    .trim();

export const hasGoogleMapsKey = (): boolean =>
  Boolean(process.env.GOOGLE_MAPS_API_KEY || process.env.GOOGLE_PLACES_API_KEY);

export async function searchGoogleMapsPlaces(
  keyword: string,
  location?: string,
  radiusKm?: number,
): Promise<GoogleMapsLeadRaw[]> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY || process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    return [];
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 7000);

  let response: Response;
  try {
    response = await fetch(GOOGLE_MAPS_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": [
          "places.id",
          "places.displayName",
          "places.formattedAddress",
          "places.nationalPhoneNumber",
          "places.websiteUri",
          "places.googleMapsUri",
          "places.primaryTypeDisplayName",
          "places.types",
          "places.businessStatus",
        ].join(","),
      },
      body: JSON.stringify({
        textQuery: [keyword, location, "Svizzera"].filter(Boolean).join(" "),
        languageCode: "it",
        regionCode: "CH",
        maxResultCount: radiusKm && radiusKm > 0 ? 15 : 12,
        openNow: false,
        strictTypeFiltering: false,
      }),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    const payload = await response.text();
    throw new Error(payload || "Errore Google Maps Places API");
  }

  const payload = (await response.json()) as { places?: GooglePlaceResult[] };
  const places = Array.isArray(payload.places) ? payload.places : [];

  return places
    .filter((place) => cleanText(place.displayName?.text).length > 0)
    .filter((place) => !place.businessStatus || place.businessStatus === "OPERATIONAL")
    .map((place) => {
      const categories = Array.isArray(place.types)
        ? place.types
            .filter((item) => typeof item === "string" && item.length > 0)
            .map(slugToLabel)
            .slice(0, 6)
        : [];

      return {
        company: cleanText(place.displayName?.text),
        sector: cleanText(place.primaryTypeDisplayName?.text) || keyword,
        address: cleanText(place.formattedAddress) || "Non disponibile",
        phone: cleanText(place.nationalPhoneNumber) || "Non disponibile",
        website: cleanText(place.websiteUri) || "Non disponibile",
        source: "google-maps" as const,
        googleMapsUrl: cleanText(place.googleMapsUri) || undefined,
        placeId: cleanText(place.id) || undefined,
        categories,
      };
    });
}
