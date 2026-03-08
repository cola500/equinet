//
//  EquinetWidget.swift
//  EquinetWidget
//
//  Entry point and configuration for the Equinet iOS widget.
//  Shows the provider's next upcoming booking on the home screen.
//

import WidgetKit
import SwiftUI

@main
struct EquinetWidgetBundle: WidgetBundle {
    var body: some Widget {
        NextBookingWidget()
    }
}

struct NextBookingWidget: Widget {
    let kind: String = "NextBookingWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: NextBookingProvider()) { entry in
            if #available(iOS 17.0, *) {
                widgetView(for: entry)
                    .containerBackground(.fill.tertiary, for: .widget)
            } else {
                widgetView(for: entry)
                    .padding()
                    .background()
            }
        }
        .configurationDisplayName("Nästa bokning")
        .description("Visa din nästa kommande bokning")
        .supportedFamilies([.systemSmall, .systemMedium])
    }

    @ViewBuilder
    private func widgetView(for entry: NextBookingEntry) -> some View {
        SmallWidgetView(entry: entry)
    }
}

#Preview(as: .systemSmall) {
    NextBookingWidget()
} timeline: {
    NextBookingEntry(date: .now, state: .authNeeded)
    NextBookingEntry(date: .now, state: .noBooking)
}
