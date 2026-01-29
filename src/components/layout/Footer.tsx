import packageJson from "../../../package.json"

export function Footer() {
  return (
    <footer className="py-4 text-center text-sm text-gray-500">
      <p>Equinet v{packageJson.version}</p>
    </footer>
  )
}
