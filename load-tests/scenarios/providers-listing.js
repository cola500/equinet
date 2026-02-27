import http from "k6/http"
import { check, sleep } from "k6"
import { getBaseUrl } from "../utils/auth.js"

/**
 * Load test: GET /api/providers (public endpoint)
 *
 * Simulates 100 concurrent users browsing the provider listing.
 * No authentication required.
 */

export const options = {
  stages: [
    { duration: "30s", target: 50 },  // ramp up to 50 VUs
    { duration: "1m", target: 100 },  // ramp up to 100 VUs
    { duration: "30s", target: 0 },   // ramp down
  ],
  thresholds: {
    http_req_duration: ["p(95)<500"],      // 95% of requests under 500ms
    http_req_failed: ["rate<0.05"],        // less than 5% errors
    http_reqs: ["rate>10"],                // at least 10 req/s
  },
}

const BASE_URL = getBaseUrl()

export default function () {
  const res = http.get(`${BASE_URL}/api/providers`)

  check(res, {
    "status is 200": (r) => r.status === 200,
    "has providers array or error": (r) => {
      const body = r.json()
      return Array.isArray(body) || body.error !== undefined
    },
  })

  sleep(1) // 1 second think time between requests
}
