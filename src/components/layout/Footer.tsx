import Link from "next/link"
import packageJson from "../../../package.json"

export function Footer() {
  return (
    <footer className="py-4 text-center text-sm text-gray-500">
      <p>Equinet v{packageJson.version}</p>
      <p className="mt-1">
        <Link href="/integritetspolicy" className="hover:text-gray-700 hover:underline">
          Integritetspolicy
        </Link>
        {" · "}
        <Link href="/anvandarvillkor" className="hover:text-gray-700 hover:underline">
          Användarvillkor
        </Link>
      </p>
    </footer>
  )
}
