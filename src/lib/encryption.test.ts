import { describe, it, expect } from "vitest"
import { encrypt, decrypt } from "./encryption"

describe("encryption", () => {
  it("should encrypt and decrypt a string", () => {
    const plaintext = "my-secret-token-12345"
    const encrypted = encrypt(plaintext)

    expect(encrypted).not.toBe(plaintext)
    expect(encrypted).toContain(":") // iv:encrypted:tag format

    const decrypted = decrypt(encrypted)
    expect(decrypted).toBe(plaintext)
  })

  it("should produce different ciphertexts for the same plaintext (random IV)", () => {
    const plaintext = "same-text"
    const encrypted1 = encrypt(plaintext)
    const encrypted2 = encrypt(plaintext)

    // Different IVs should produce different ciphertexts
    expect(encrypted1).not.toBe(encrypted2)

    // Both should decrypt correctly
    expect(decrypt(encrypted1)).toBe(plaintext)
    expect(decrypt(encrypted2)).toBe(plaintext)
  })

  it("should handle empty strings", () => {
    const encrypted = encrypt("")
    const decrypted = decrypt(encrypted)
    expect(decrypted).toBe("")
  })

  it("should handle special characters and unicode", () => {
    const plaintext = "token_with-special.chars/and=base64+encoded=="
    const encrypted = encrypt(plaintext)
    const decrypted = decrypt(encrypted)
    expect(decrypted).toBe(plaintext)
  })

  it("should throw on invalid encrypted data format", () => {
    expect(() => decrypt("invalid-data")).toThrow("Invalid encrypted data format")
  })

  it("should throw on tampered ciphertext", () => {
    const encrypted = encrypt("secret")
    const parts = encrypted.split(":")
    // Tamper with the encrypted portion
    parts[1] = "0000" + parts[1].substring(4)
    const tampered = parts.join(":")

    expect(() => decrypt(tampered)).toThrow()
  })
})
