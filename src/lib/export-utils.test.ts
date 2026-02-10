import { describe, it, expect } from "vitest"
import {
  objectsToCsv,
  flattenBookings,
  flattenNotes,
  flattenUserProfile,
  flattenHorses,
  flattenReviews,
  flattenProvider,
  flattenProviderServices,
} from "./export-utils"

describe("objectsToCsv", () => {
  it("should convert simple objects to CSV", () => {
    const rows = [
      { name: "Anna", age: 30 },
      { name: "Magnus", age: 25 },
    ]

    const csv = objectsToCsv(rows)
    expect(csv).toBe("name,age\nAnna,30\nMagnus,25")
  })

  it("should escape fields with commas", () => {
    const rows = [{ name: "Doe, John", city: "Stockholm" }]
    const csv = objectsToCsv(rows)
    expect(csv).toBe('name,city\n"Doe, John",Stockholm')
  })

  it("should escape fields with quotes", () => {
    const rows = [{ note: 'Called "urgent"' }]
    const csv = objectsToCsv(rows)
    expect(csv).toBe('note\n"Called ""urgent"""')
  })

  it("should handle null and undefined values", () => {
    const rows = [{ a: null, b: undefined, c: "ok" }]
    const csv = objectsToCsv(rows)
    expect(csv).toBe("a,b,c\n,,ok")
  })

  it("should return empty string for empty array", () => {
    expect(objectsToCsv([])).toBe("")
  })

  it("should escape fields with newlines", () => {
    const rows = [{ note: "line1\nline2" }]
    const csv = objectsToCsv(rows)
    expect(csv).toBe('note\n"line1\nline2"')
  })
})

describe("flattenBookings", () => {
  it("should flatten booking data", () => {
    const bookings = [
      {
        id: "b-1",
        bookingDate: new Date("2026-02-15"),
        startTime: "09:00",
        endTime: "09:45",
        status: "completed",
        service: { name: "Hovslagning" },
        provider: { businessName: "Magnus Hovslagar" },
        horse: { name: "Blansen" },
        customerNotes: "Extra försiktig",
      },
    ]

    const flat = flattenBookings(bookings)
    expect(flat).toHaveLength(1)
    expect(flat[0]).toEqual({
      bookingId: "b-1",
      bookingDate: "2026-02-15",
      startTime: "09:00",
      endTime: "09:45",
      status: "completed",
      serviceName: "Hovslagning",
      providerName: "Magnus Hovslagar",
      horseName: "Blansen",
      customerNotes: "Extra försiktig",
    })
  })

  it("should handle missing relations", () => {
    const bookings = [
      {
        id: "b-2",
        bookingDate: "2026-02-15T00:00:00.000Z",
        startTime: "10:00",
        endTime: "10:30",
        status: "pending",
        horseName: "Thunder",
      },
    ]

    const flat = flattenBookings(bookings)
    expect(flat[0].serviceName).toBe("")
    expect(flat[0].providerName).toBe("")
    expect(flat[0].horseName).toBe("Thunder")
  })
})

describe("flattenNotes", () => {
  it("should flatten note data", () => {
    const notes = [
      {
        id: "n-1",
        category: "veterinary",
        title: "Vaccination",
        content: "Influensa + tetanus",
        noteDate: new Date("2026-01-10"),
        horse: { name: "Blansen" },
        author: { firstName: "Dr", lastName: "Smith" },
      },
    ]

    const flat = flattenNotes(notes)
    expect(flat[0]).toEqual({
      noteId: "n-1",
      horseName: "Blansen",
      category: "veterinary",
      title: "Vaccination",
      content: "Influensa + tetanus",
      noteDate: "2026-01-10",
      authorName: "Dr Smith",
    })
  })

  it("should use fallback horseName", () => {
    const notes = [
      {
        id: "n-2",
        category: "general",
        title: "Note",
        noteDate: "2026-01-10T00:00:00.000Z",
      },
    ]

    const flat = flattenNotes(notes, "Stjansen")
    expect(flat[0].horseName).toBe("Stjansen")
  })
})

describe("flattenUserProfile", () => {
  it("should flatten user profile data", () => {
    const user = {
      id: "u-1",
      email: "anna@test.se",
      firstName: "Anna",
      lastName: "Svensson",
      phone: "0701234567",
      userType: "customer",
      city: "Stockholm",
      address: "Storgatan 1",
      createdAt: new Date("2026-01-01"),
    }

    const flat = flattenUserProfile(user)
    expect(flat).toEqual({
      email: "anna@test.se",
      firstName: "Anna",
      lastName: "Svensson",
      phone: "0701234567",
      userType: "customer",
      city: "Stockholm",
      address: "Storgatan 1",
      createdAt: "2026-01-01",
    })
  })

  it("should exclude internal id", () => {
    const user = {
      id: "u-1",
      email: "test@test.se",
      firstName: null,
      lastName: null,
      phone: null,
      userType: "customer",
      city: null,
      address: null,
      createdAt: new Date("2026-01-01"),
    }

    const flat = flattenUserProfile(user)
    expect(flat).not.toHaveProperty("id")
  })

  it("should handle null fields", () => {
    const user = {
      id: "u-1",
      email: "test@test.se",
      firstName: null,
      lastName: null,
      phone: null,
      userType: "customer",
      city: null,
      address: null,
      createdAt: new Date("2026-01-01"),
    }

    const flat = flattenUserProfile(user)
    expect(flat.firstName).toBe("")
    expect(flat.phone).toBe("")
    expect(flat.city).toBe("")
    expect(flat.address).toBe("")
  })
})

describe("flattenHorses", () => {
  it("should flatten horse data", () => {
    const horses = [
      {
        id: "h-1",
        name: "Blansen",
        breed: "Svenskt varmblod",
        birthYear: 2018,
        color: "Brun",
        gender: "gelding",
        specialNeeds: "Känsliga hovar",
        registrationNumber: "752009876543210",
        microchipNumber: "752093100012345",
        createdAt: new Date("2026-01-05"),
      },
    ]

    const flat = flattenHorses(horses)
    expect(flat).toHaveLength(1)
    expect(flat[0]).toEqual({
      name: "Blansen",
      breed: "Svenskt varmblod",
      birthYear: 2018,
      color: "Brun",
      gender: "gelding",
      specialNeeds: "Känsliga hovar",
      registrationNumber: "752009876543210",
      microchipNumber: "752093100012345",
      createdAt: "2026-01-05",
    })
  })

  it("should handle null optional fields", () => {
    const horses = [
      {
        id: "h-2",
        name: "Thunder",
        breed: null,
        birthYear: null,
        color: null,
        gender: "mare",
        specialNeeds: null,
        registrationNumber: null,
        microchipNumber: null,
        createdAt: new Date("2026-01-05"),
      },
    ]

    const flat = flattenHorses(horses)
    expect(flat[0].breed).toBe("")
    expect(flat[0].birthYear).toBe("")
    expect(flat[0].color).toBe("")
    expect(flat[0].specialNeeds).toBe("")
    expect(flat[0].registrationNumber).toBe("")
    expect(flat[0].microchipNumber).toBe("")
  })

  it("should return empty array for empty input", () => {
    expect(flattenHorses([])).toEqual([])
  })
})

describe("flattenReviews", () => {
  it("should flatten review data", () => {
    const reviews = [
      {
        id: "r-1",
        rating: 5,
        comment: "Excellent!",
        reply: "Tack!",
        repliedAt: new Date("2026-02-17"),
        createdAt: new Date("2026-02-16"),
        provider: { businessName: "Magnus Hovslagar" },
        booking: {
          bookingDate: new Date("2026-02-15"),
          service: { name: "Hovslagning" },
        },
      },
    ]

    const flat = flattenReviews(reviews)
    expect(flat).toHaveLength(1)
    expect(flat[0]).toEqual({
      rating: 5,
      comment: "Excellent!",
      reply: "Tack!",
      repliedAt: "2026-02-17",
      providerName: "Magnus Hovslagar",
      bookingDate: "2026-02-15",
      serviceName: "Hovslagning",
      createdAt: "2026-02-16",
    })
  })

  it("should handle missing reply and relations", () => {
    const reviews = [
      {
        id: "r-2",
        rating: 3,
        comment: "OK",
        reply: null,
        repliedAt: null,
        createdAt: new Date("2026-02-16"),
        provider: { businessName: "Test" },
        booking: null,
      },
    ]

    const flat = flattenReviews(reviews)
    expect(flat[0].reply).toBe("")
    expect(flat[0].repliedAt).toBe("")
    expect(flat[0].bookingDate).toBe("")
    expect(flat[0].serviceName).toBe("")
  })
})

describe("flattenProvider", () => {
  it("should flatten provider data", () => {
    const provider = {
      id: "p-1",
      businessName: "Magnus Hovslagar",
      description: "Professionell hovslagare",
      address: "Hovvägen 1",
      city: "Göteborg",
      postalCode: "41234",
      serviceAreaKm: 50,
      isVerified: true,
      createdAt: new Date("2026-01-01"),
    }

    const flat = flattenProvider(provider)
    expect(flat).toEqual({
      businessName: "Magnus Hovslagar",
      description: "Professionell hovslagare",
      address: "Hovvägen 1",
      city: "Göteborg",
      postalCode: "41234",
      serviceAreaKm: 50,
      isVerified: true,
      createdAt: "2026-01-01",
    })
  })

  it("should handle null optional fields", () => {
    const provider = {
      id: "p-2",
      businessName: "Test",
      description: null,
      address: null,
      city: null,
      postalCode: null,
      serviceAreaKm: null,
      isVerified: false,
      createdAt: new Date("2026-01-01"),
    }

    const flat = flattenProvider(provider)
    expect(flat.description).toBe("")
    expect(flat.address).toBe("")
    expect(flat.city).toBe("")
    expect(flat.postalCode).toBe("")
    expect(flat.serviceAreaKm).toBe("")
  })
})

describe("flattenProviderServices", () => {
  it("should flatten service data", () => {
    const services = [
      {
        id: "s-1",
        name: "Hovslagning",
        description: "Skoning av hästar",
        price: 500,
        durationMinutes: 45,
        isActive: true,
      },
    ]

    const flat = flattenProviderServices(services)
    expect(flat).toHaveLength(1)
    expect(flat[0]).toEqual({
      name: "Hovslagning",
      description: "Skoning av hästar",
      price: 500,
      durationMinutes: 45,
      isActive: true,
    })
  })

  it("should handle null description", () => {
    const services = [
      {
        id: "s-2",
        name: "Massage",
        description: null,
        price: 300,
        durationMinutes: 30,
        isActive: false,
      },
    ]

    const flat = flattenProviderServices(services)
    expect(flat[0].description).toBe("")
  })

  it("should return empty array for empty input", () => {
    expect(flattenProviderServices([])).toEqual([])
  })
})
