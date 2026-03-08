//
//  EquinetWidget.swift
//  EquinetWidget
//
//  Entry point for the Equinet WidgetKit extension.
//  Shows the provider's next upcoming booking.
//

import SwiftUI
import WidgetKit

struct EquinetWidget: Widget {
    let kind: String = "EquinetNextBooking"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: NextBookingProvider()) { entry in
            EquinetWidgetEntryView(entry: entry)
                .containerBackground(.fill.tertiary, for: .widget)
        }
        .configurationDisplayName("Nästa bokning")
        .description("Visar din nästa kommande bokning")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}

struct EquinetWidgetEntryView: View {
    @Environment(\.widgetFamily) var family
    let entry: NextBookingEntry

    var body: some View {
        switch family {
        case .systemSmall:
            SmallWidgetView(entry: entry)
        case .systemMedium:
            MediumWidgetView(entry: entry)
        default:
            SmallWidgetView(entry: entry)
        }
    }
}

// MARK: - Widget Bundle

@main
struct EquinetWidgetBundle: WidgetBundle {
    var body: some Widget {
        EquinetWidget()
    }
}

// MARK: - Previews

#Preview("Small - Booking", as: .systemSmall) {
    EquinetWidget()
} timeline: {
    NextBookingEntry(date: Date(), state: .hasBooking(WidgetBooking(
        id: "1",
        bookingDate: "2026-03-10T00:00:00.000Z",
        startTime: "10:00",
        endTime: "11:00",
        status: "confirmed",
        horseName: "Blansen",
        customerFirstName: "Anna",
        customerLastName: "Andersson",
        serviceName: "Hovslagare"
    )))
}

#Preview("Small - Empty", as: .systemSmall) {
    EquinetWidget()
} timeline: {
    NextBookingEntry(date: Date(), state: .noBooking)
}

#Preview("Medium - Booking", as: .systemMedium) {
    EquinetWidget()
} timeline: {
    NextBookingEntry(date: Date(), state: .hasBooking(WidgetBooking(
        id: "1",
        bookingDate: "2026-03-10T00:00:00.000Z",
        startTime: "10:00",
        endTime: "11:00",
        status: "confirmed",
        horseName: "Blansen",
        customerFirstName: "Anna",
        customerLastName: "Andersson",
        serviceName: "Hovslagare"
    )))
}

#Preview("Medium - Auth Needed", as: .systemMedium) {
    EquinetWidget()
} timeline: {
    NextBookingEntry(date: Date(), state: .authNeeded)
}
