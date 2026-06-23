import { NextResponse } from "next/server";

export const runtime = "nodejs";

interface OSMElement {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

interface NearbyService {
  id: string;
  name: string;
  type: "hospital" | "clinic" | "ambulance_station";
  address: string;
  phone: string;
  distanceKm: number;
  lat: number;
  lng: number;
  mapLink: string;
}

function getDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Radius of the earth in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function buildQuery(lat: number, lng: number, radius: number): string {
  return `[out:json][timeout:25];
(
node["amenity"="hospital"](around:${radius},${lat},${lng});
way["amenity"="hospital"](around:${radius},${lat},${lng});
relation["amenity"="hospital"](around:${radius},${lat},${lng});

node["amenity"="clinic"](around:${radius},${lat},${lng});
way["amenity"="clinic"](around:${radius},${lat},${lng});
relation["amenity"="clinic"](around:${radius},${lat},${lng});

node["amenity"="doctors"](around:${radius},${lat},${lng});
way["amenity"="doctors"](around:${radius},${lat},${lng});
relation["amenity"="doctors"](around:${radius},${lat},${lng});

node["healthcare"="hospital"](around:${radius},${lat},${lng});
way["healthcare"="hospital"](around:${radius},${lat},${lng});
relation["healthcare"="hospital"](around:${radius},${lat},${lng});

node["healthcare"="clinic"](around:${radius},${lat},${lng});
way["healthcare"="clinic"](around:${radius},${lat},${lng});
relation["healthcare"="clinic"](around:${radius},${lat},${lng});
);
out center tags 25;`;
}

function parseElements(elements: OSMElement[], userLat: number, userLng: number): NearbyService[] {
  return elements
    .map((el) => {
      let lat: number | undefined;
      let lng: number | undefined;

      if (el.type === "node") {
        lat = el.lat;
        lng = el.lon;
      } else if (el.type === "way" || el.type === "relation") {
        lat = el.center?.lat;
        lng = el.center?.lon;
      }

      if (lat === undefined || lng === undefined) {
        return null;
      }

      const tags = el.tags || {};

      // Determine service type
      let serviceType: "hospital" | "clinic" | "ambulance_station" = "hospital";
      if (tags.amenity === "clinic" || tags.healthcare === "clinic" || tags.amenity === "doctors") {
        serviceType = "clinic";
      } else if (tags.emergency === "ambulance_station") {
        serviceType = "ambulance_station";
      }

      // Determine name
      const name =
        tags.name ||
        (serviceType === "hospital"
          ? "Unnamed Hospital"
          : serviceType === "clinic"
          ? "Unnamed Clinic"
          : "Medical Service");

      // Format phone number
      const phone =
        tags.phone ||
        tags["contact:phone"] ||
        tags["contact:mobile"] ||
        "";

      // Construct address
      const addrParts: string[] = [];
      if (tags["addr:housenumber"]) addrParts.push(tags["addr:housenumber"]);
      if (tags["addr:street"]) addrParts.push(tags["addr:street"]);
      if (tags["addr:suburb"]) addrParts.push(tags["addr:suburb"]);
      if (tags["addr:city"]) addrParts.push(tags["addr:city"]);
      if (tags["addr:postcode"]) addrParts.push(tags["addr:postcode"]);
      const address = tags["addr:full"] || addrParts.join(", ") || "Address not available";

      const distanceKm = getDistanceKm(userLat, userLng, lat, lng);

      return {
        id: String(el.id),
        name,
        type: serviceType,
        address,
        phone,
        distanceKm: parseFloat(distanceKm.toFixed(2)),
        lat,
        lng,
        mapLink: `https://www.google.com/maps?q=${lat},${lng}`,
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);
}

async function fetchFromOverpass(query: string, endpointLogs: (msg: string) => void): Promise<any> {
  const endpoints = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass.openstreetmap.ru/api/interpreter",
  ];

  let lastError: any = null;

  for (const endpoint of endpoints) {
    endpointLogs(`[Overpass] Endpoint used: ${endpoint}`);
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12000); // 12s timeout

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
          "User-Agent": "MediScan-AI-Emergency-SOS/1.0",
        },
        body: new URLSearchParams({ data: query }).toString(),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      endpointLogs(`[Overpass] Response status: ${response.status}`);

      if (response.ok) {
        const data = await response.json();
        return { data, endpoint };
      } else {
        lastError = new Error(`Overpass API responded with status ${response.status}`);
      }
    } catch (err: any) {
      endpointLogs(`[Overpass] Error from ${endpoint}: ${err.message || err}`);
      lastError = err;
    }
  }

  throw lastError || new Error("All Overpass endpoints failed");
}

export async function POST(request: Request) {
  try {
    const { lat, lng } = await request.json();
    console.log(`[Overpass] received lat/lng: ${lat}, ${lng}`);

    if (typeof lat !== "number" || typeof lng !== "number") {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid input",
          details: "Latitude and longitude are required and must be numbers.",
          results: [],
        },
        { status: 400 }
      );
    }

    let radius = 5000;
    console.log(`[Overpass] radius used: ${radius}`);

    let query = buildQuery(lat, lng, radius);
    let overpassResponse: any;
    let endpointUsed = "";

    try {
      overpassResponse = await fetchFromOverpass(query, (msg) => console.log(msg));
      endpointUsed = overpassResponse.endpoint;
    } catch (error: any) {
      // Retry with 10000 if 5000 failed completely
      console.log(`[Overpass] 5000m query failed: ${error.message || error}. Retrying at 10000m.`);
    }

    let elements: OSMElement[] = overpassResponse?.data?.elements || [];
    let results = parseElements(elements, lat, lng);

    // If no results parsed at 5000m (or if 5000m request failed entirely), retry with 10000m
    if (results.length === 0) {
      radius = 10000;
      console.log(`[Overpass] radius used: ${radius} (retry)`);
      query = buildQuery(lat, lng, radius);
      
      overpassResponse = await fetchFromOverpass(query, (msg) => console.log(msg));
      endpointUsed = overpassResponse.endpoint;
      elements = overpassResponse?.data?.elements || [];
      results = parseElements(elements, lat, lng);
    }

    // Sort by distance ascending
    results.sort((a, b) => a.distanceKm - b.distanceKm);
    console.log(`[Overpass] result count: ${results.length}`);

    if (results.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No nearby hospitals found",
        results: [],
      });
    }

    return NextResponse.json({ success: true, results });
  } catch (error: any) {
    console.log(`[Overpass] error details: ${error.message || error}`);
    return NextResponse.json(
      {
        success: false,
        error: "Overpass API failed",
        details: error.message || "Unknown error occurred",
        results: [],
      },
      { status: 200 }
    );
  }
}
