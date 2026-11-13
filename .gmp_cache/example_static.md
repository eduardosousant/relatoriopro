This document outlines the best practices for integrating the Google Maps Static
API into a React framework. The Static Maps API generates a map image based on
URL parameters, which is then rendered via a standard HTML `<img>` tag.

This pattern is fundamentally different from using the Maps JavaScript SDK, as
it relies purely on REST URL construction and avoids client-side map rendering
components.

## 1. Static Maps Architectural Pattern

The recommended pattern involves creating a utility function to reliably
construct the Static Maps API endpoint URL using a configuration object, and
then rendering the resulting URL in a standard React component.

### 1.1. Static Map URL Builder Utility

This utility handles parameter encoding, API key injection, and definition
mapping.

```typescript
// src/utils/staticMapUrlBuilder.ts

/** Defines configuration parameters for the Static Maps API. */
export interface StaticMapConfig {
  center: string; // e.g., '40.712776,-74.005974' or 'Paris, France'
  zoom: number;
  size: string; // e.g., '600x300'
  maptype?: 'roadmap' | 'satellite' | 'terrain' | 'hybrid';
  markers?: string[]; // Array of marker definitions: 'color:blue|label:A|40.7...'
  path?: string; // Path definition: 'color:0x0000ff|weight:5|enc:...'
  style?: string[]; // Style definitions (e.g., 'feature:road|element:all|saturation:-100')
  scale?: 1 | 2; // For high DPI displays
}

/**
 * Constructs the Google Maps Static API URL.
 * NOTE: Assumes API Key is securely loaded via environment variables.
 */
export const buildStaticMapUrl = (config: StaticMapConfig): string => {
  // Use a secure method to access the API Key (e.g., environment variable)
  const apiKey = process.env.REACT_APP_GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    console.error('CRITICAL: Static Maps API Key not found.');
    return '';
  }

  const params = new URLSearchParams();
  params.append('center', config.center);
  params.append('zoom', config.zoom.toString());
  params.append('size', config.size);
  params.append('key', apiKey);

  if (config.maptype) {
    params.append('maptype', config.maptype);
  }
  if (config.scale) {
    params.append('scale', config.scale.toString());
  }

  // Append repeatable parameters (markers, styles)
  if (config.markers && config.markers.length > 0) {
    config.markers.forEach(marker => params.append('markers', marker));
  }

  if (config.path) {
    params.append('path', config.path);
  }

  if (config.style && config.style.length > 0) {
      config.style.forEach(style => params.append('style', style));
  }

  return `https://maps.googleapis.com/maps/api/staticmap?${params.toString()}`;
};
```

### 1.2. React Component for Rendering

A dedicated component uses `useMemo` to cache the generated URL, ensuring
efficiency and preventing unnecessary re-calculations.

```tsx
// src/components/StaticMapRenderer.tsx
import React, { useMemo } from 'react';
import { buildStaticMapUrl, StaticMapConfig } from '../utils/staticMapUrlBuilder';

interface StaticMapProps {
  config: StaticMapConfig;
  alt: string;
}

/**
 * Renders a Google Maps Static API image based on the provided configuration.
 */
export const StaticMapRenderer: React.FC<StaticMapProps> = ({ config, alt }) => {
  // Generate the image URL only when the configuration changes
  const mapUrl = useMemo(() => {
    return buildStaticMapUrl(config);
  }, [config]);

  if (!mapUrl) {
    return <div className="static-map-error">Map configuration error.</div>;
  }

  return (
    <img
      src={mapUrl}
      alt={alt}
      // Apply appropriate styling for layout management
      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
    />
  );
};
```

## 2. Usage Examples (Correlating to `StaticMap1` through `StaticMap4`)

The main application file (`app.tsx`) uses the `StaticMapRenderer` component
with different configurations to demonstrate key capabilities.

### 2.1. Basic Configuration (Roadmap)

Renders a standard map centered on a location with a defined size and zoom
level.

```tsx
// Example of StaticMap1 implementation
const BasicMap = () => {
    const config: StaticMapConfig = {
        center: '40.7128,-74.0060', // New York City
        zoom: 14,
        size: '400x300',
        maptype: 'roadmap',
    };
    return <StaticMapRenderer config={config} alt="Basic Roadmap of NYC" />;
};
```

### 2.2. Custom Markers and Hybrid View

Demonstrates how to define custom map markers (size, color, label) and utilize
the `hybrid` map type.

```tsx
// Example of StaticMap2 implementation
const MarkerMap = () => {
    const config: StaticMapConfig = {
        center: 'Boston, MA',
        zoom: 13,
        size: '400x300',
        maptype: 'hybrid',
        markers: [
            // Custom red marker 'H'
            'size:mid|color:red|label:H|42.3601,-71.0589',
            // Default blue marker
            '42.3584,-71.0968',
        ],
        scale: 2, // Enable high DPI rendering
    };
    return <StaticMapRenderer config={config} alt="Hybrid Map with Custom Markers" />;
};
```

### 2.3. Paths and Polylines

Illustrates adding a path (polyline) to the map image to denote a route or
boundary.

```tsx
// Example of StaticMap3 implementation
const PathMap = () => {
    const config: StaticMapConfig = {
        center: 'San Francisco, CA',
        zoom: 11,
        size: '400x300',
        path: 'color:0x0000ff80|weight:5|37.78,-122.41|37.79,-122.39|37.81,-122.40',
        alt: "Map showing a path definition.",
    };
    return <StaticMapRenderer config={config} alt="Map with Path Overlay" />;
};
```

### 2.4. Custom Styling (Styled Map)

Shows how to apply JSON map styling definitions directly via URL parameters.
Note that the style definition must be a single string per parameter
(`style=...`).

```tsx
// Example of StaticMap4 implementation
const StyledMap = () => {
    // Style to gray-scale everything except water features
    const customStyles = [
        'feature:all|saturation:-100',
        'feature:water|visibility:on|color:0x444444',
    ];

    const config: StaticMapConfig = {
        center: 'London, UK',
        zoom: 11,
        size: '400x300',
        maptype: 'roadmap',
        style: customStyles,
    };
    return <StaticMapRenderer config={config} alt="Styled Gray-scale Map" />;
};
```

## 3. Best Practices and Critical Gotchas

### A. CORS Preflight Distinction

**CRITICAL GUARDRAIL:** The Static Maps API returns a standard image file
(`.png`, `.jpg`), not structured data. Therefore, fetching the URL via an
`<img>` tag is a standard browser operation and **is not subject to CORS
preflight restrictions** that block direct browser `fetch()` requests to REST
data endpoints (like Routes API or Geocoding API).

*   **Allowed Pattern:** Generating a URL and placing it in `<img src="..." />`.
*   **Prohibited Anti-Pattern (for Data APIs):** Using `fetch()` or `axios` in a
    client-side component to retrieve JSON data directly from
    `routes.googleapis.com` or other backend REST endpoints.

### B. API Key Security

Since the Static Maps API Key must be embedded directly into the public URL
(`key=YOUR_API_KEY`), it is visible in browser network traffic.

**Best Practice:** Ensure that the API key used for Static Maps is properly
restricted in the Google Cloud Console to only work with the Static Maps API
and, critically, restricted by your application's HTTP referrer (domain name) to
prevent unauthorized usage.

### C. Casing and REST Schema

For the Static Maps API, parameters are standard URL query parameters (e.g.,
`center`, `zoom`, `markers`). Casing nuances related to SDK vs. REST JSON schema
(like `formattedAddress` vs. `formatted_address`) do not apply to this specific
API. Always adhere strictly to the parameter names defined in the Static Maps
API documentation.

### D. Interactive Map vs. Static Map

This Static Maps implementation **cannot** use the standard interactive `<Map>`
component provided by `@googlemaps/react-wrapper`.

If you transition to an interactive map component, you **MUST** ensure the
`internalUsageAttributionIds` prop is present:

```tsx
// Interactive Map (using @googlemaps/react-wrapper <Map>)
<Map
  center={{ lat: 40.7, lng: -74.0 }}
  zoom={14}
  // MANDATORY PROP for Google usage tracking
  internalUsageAttributionIds={['gmp_git_agentskills_v1']}
/>
```
