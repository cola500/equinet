/**
 * Route Optimizer API Client
 *
 * Integrerar med Modal.com API från Experiment 001 för att optimera hovslagarrutter.
 */

const MODAL_API_URL = process.env.MODAL_API_URL || 'https://johanlin--route-optimizer-fastapi-app.modal.run'

export interface Location {
  lat: number;
  lon: number;
  id?: number;
  customer?: string;
  address?: string;
  service?: string;
}

export interface OptimizeResponse {
  route: number[];
  total_distance_km: number;
  num_stops: number;
  optimized_orders: Location[];
  baseline_distance_km: number;
  improvement_percent: number;
}

// Använd Next.js API route som proxy för att undvika CSP-problem
const API_URL = '/api';

/**
 * Optimera rutt via Modal API (genom Next.js proxy)
 */
export async function optimizeRoute(
  startLocation: Location,
  orders: Location[]
): Promise<OptimizeResponse> {
  try {
    const response = await fetch(`${API_URL}/optimize-route`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        start_location: startLocation,
        orders: orders,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Optimization failed: ${response.statusText} - ${errorText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Route optimization error:', error);
    throw error;
  }
}

/**
 * Generera mock-koordinater runt Stockholm för PoC
 * I framtiden: ersätt med riktig geocoding
 */
export function generateMockCoordinates(index: number): { lat: number; lon: number } {
  const baseLatStockholm = 59.3293;
  const baseLonStockholm = 18.0686;

  // Spread ut beställningar inom ~50km radie
  // Använd index för att få konsistenta positioner
  const angle = (index * 2.4) % (2 * Math.PI); // ~golden angle för bra distribution
  const radius = 0.1 + (index % 5) * 0.1; // 0.1-0.5 grader (ca 10-50km)

  return {
    lat: baseLatStockholm + Math.cos(angle) * radius,
    lon: baseLonStockholm + Math.sin(angle) * radius,
  };
}

/**
 * Testa API-anslutning
 */
export async function testApiConnection(): Promise<boolean> {
  try {
    const response = await fetch(`${MODAL_API_URL}/`, {
      method: 'GET',
    });

    if (response.ok) {
      const data = await response.json();
      console.log('Modal API health check:', data);
      return true;
    }

    return false;
  } catch (error) {
    console.error('API connection test failed:', error);
    return false;
  }
}
