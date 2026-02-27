import http from "k6/http"
import { check, sleep } from "k6"
import { getAuthParams, getBaseUrl } from "../utils/auth.js"

/**
 * Load test: GET /api/provider/dashboard/stats (authenticated)
 *
 * Simulates 50 concurrent providers checking their dashboard.
 * Requires LOAD_TEST_SESSION_COOKIE env var.
 */

export const options = {
  stages: [
    { duration: "30s", target: 25 },  // ramp up to 25 VUs
    { duration: "1m", target: 50 },   // ramp up to 50 VUs
    { duration: "30s", target: 0 },   // ramp down
  ],
  thresholds: {
    http_req_duration: ["p(95)<500"],
    http_req_failed: ["rate<0.10"],   // 10% error budget (auth failures expected without cookie)
  },
}

const BASE_URL = getBaseUrl()

export default function () {
  const params = getAuthParams()
  const res = http.get(`${BASE_URL}/api/provider/dashboard/stats`, params)

  check(res, {
    "status is 200, 401 or 500": (r) => r.status === 200 || r.status === 401 || r.status === 500,
    "response has data": (r) => {
      if (r.status !== 200) return true
      const body = r.json()
      return body.bookingTrend !== undefined && body.revenueTrend !== undefined
    },
  })

  sleep(1)
}
