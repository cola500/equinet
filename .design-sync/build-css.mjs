import postcss from "postcss"
import tailwindcss from "@tailwindcss/postcss"
import { readFileSync, writeFileSync } from "node:fs"

const input = readFileSync("src/app/globals.css", "utf8")

postcss([tailwindcss()])
  .process(input, { from: "src/app/globals.css", to: ".design-sync/.cache/compiled.css" })
  .then((result) => {
    writeFileSync(".design-sync/.cache/compiled.css", result.css)
    console.log(`Wrote ${result.css.length} bytes`)
  })
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
