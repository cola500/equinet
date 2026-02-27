import http from "k6/http"
import { check, sleep } from "k6"
import { getAuthParams, getBaseUrl } from "../utils/auth.js"

/**
 * Load test: GET /api/provider/insights?months=6 (authenticated)
 *
 * Simulates 50 concurrent providers viewing their insights page.
 * This is the heaviest endpoint (multiple DB queries + data aggregation).
 * Requires LOAD_TEST_SESSION_COOKIE env var.
 */

export const options = {
  stages: [
    { duration: "30s", target: 25 },  // ramp up to 25 VUs
    { duration: "1m", target: 50 },   // ramp up to 50 VUs
    { duration: "30s", target: 0 },   // ramp down
  ],
  thresholds: {
    http_req_duration: ["p(95)<1000"],  // 1s threshold (heavier endpoint)
    http_req_failed: ["rate<0.10"],
  },
}

const BASE_URL = getBaseUrl()

export default function () {
  const params = getAuthParams()
  const res = http.get(`${BASE_URL}/api/provider/insights?months=6`, params)

  check(res, {
    "status is 200 or 401": (r) => r.status === 200 || r.status === 401,
    "response has insights data": (r) => {
      if (r.status !== 200) return true
      const body = r.json()
      return body.kpis !== undefined && body.serviceBreakdown !== undefined
    },
  })

  sleep(1)
}
