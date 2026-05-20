import Link from "next/link"

export function Footer() {
  return (
    <footer className="py-4 text-center text-sm text-gray-500">
      <p>
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
