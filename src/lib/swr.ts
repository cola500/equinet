/**
 * SWR fetcher and configuration.
 *
 * The fetcher is the function SWR uses to retrieve data from an API endpoint.
 * It throws on non-OK responses so SWR can surface errors via the `error` property.
 */
export const fetcher = async (url: string) => {
  const res = await fetch(url)
  if (!res.ok) {
    const error = new Error("API request failed")
    throw error
  }
  return res.json()
}
