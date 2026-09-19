// api/vin.js — Vercel serverless function
// Proxies NHTSA vPIC VIN decode to avoid browser CORS restrictions.
// Free, no API key required. Works for all vehicles sold in North America.
// Usage: GET /api/vin?vin=1HGCM82633A004352

export default async function handler(req, res) {
  // CORS headers so the React app can call this from any origin
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  const { vin } = req.query;

  if (!vin || vin.length < 11) {
    return res.status(400).json({ error: "VIN must be at least 11 characters." });
  }

  const clean = vin.trim().toUpperCase().replace(/[^A-HJ-NPR-Z0-9]/g, "");

  try {
    const url = `https://vpic.nhtsa.dot.gov/api/vehicles/decodevinvalues/${clean}?format=json`;
    const response = await fetch(url, {
      headers: { "Accept": "application/json" },
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) {
      throw new Error(`NHTSA returned ${response.status}`);
    }

    const data = await response.json();
    const results = data.Results?.[0];

    if (!results || results.ErrorCode === "8") {
      return res.status(404).json({ error: "VIN not found in NHTSA database." });
    }

    // Return only the fields useful for AutoFlip Pro
    const vehicle = {
      vin: clean,
      year:         results.ModelYear         || "",
      make:         results.Make              || "",
      model:        results.Model             || "",
      trim:         results.Trim              || "",
      series:       results.Series            || "",
      bodyClass:    results.BodyClass         || "",
      driveType:    results.DriveType         || "",
      engineSize:   results.DisplacementL     || "",
      cylinders:    results.EngineCylinders   || "",
      fuelType:     results.FuelTypePrimary   || "",
      transmission: results.TransmissionStyle || "",
      doors:        results.Doors             || "",
      plant:        results.PlantCity         || "",
      plantCountry: results.PlantCountry      || "",
      manufacturer: results.Manufacturer      || "",
      vehicleType:  results.VehicleType       || "",
      errorCode:    results.ErrorCode         || "0",
      errorText:    results.ErrorText         || "",
    };

    // Cache for 7 days — VIN specs never change
    res.setHeader("Cache-Control", "public, max-age=604800, stale-while-revalidate=86400");
    return res.status(200).json({ success: true, vehicle });

  } catch (err) {
    console.error("NHTSA VIN decode error:", err.message);
    return res.status(500).json({ error: `VIN decode failed: ${err.message}` });
  }
}
