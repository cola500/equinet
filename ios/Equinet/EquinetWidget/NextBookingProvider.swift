//
//  NextBookingProvider.swift
//  EquinetWidget
//
//  TimelineProvider that reads booking data from App Group shared storage.
//  Falls back to API fetch if network is available.
//

import WidgetKit

struct NextBookingProvider: TimelineProvider {

    func placeholder(in context: Context) -> NextBookingEntry {
        NextBookingEntry(date: Date(), state: .loading)
    }

    func getSnapshot(in context: Context, completion: @escaping (NextBookingEntry) -> Void) {
        let entry = entryFromSharedData() ?? NextBookingEntry(date: Date(), state: .loading)
        completion(entry)
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<NextBookingEntry>) -> Void) {
        // Try shared data first (fast, no network)
        let entry = entryFromSharedData() ?? NextBookingEntry(date: Date(), state: .authNeeded)

        // Schedule next refresh
        let refreshDate: Date
        switch entry.state {
        case .hasBooking(let booking):
            // Refresh at booking start time or in 30 minutes, whichever is sooner
            let bookingStart = parseBookingDateTime(date: booking.bookingDate, time: booking.startTime)
            let thirtyMinutes = Date().addingTimeInterval(30 * 60)
            refreshDate = min(bookingStart ?? thirtyMinutes, thirtyMinutes)
        case .noBooking:
            refreshDate = Date().addingTimeInterval(60 * 60) // 1 hour
        case .authNeeded:
            refreshDate = Date().addingTimeInterval(15 * 60) // 15 minutes
        case .loading:
            refreshDate = Date().addingTimeInterval(5 * 60) // 5 minutes
        }

        let timeline = Timeline(entries: [entry], policy: .after(refreshDate))
        completion(timeline)
    }

    // MARK: - Private

    private func entryFromSharedData() -> NextBookingEntry? {
        guard let data = SharedDataManager.loadWidgetData() else {
            return nil
        }

        if !data.hasAuth {
            return NextBookingEntry(date: Date(), state: .authNeeded)
        }

        if let booking = data.booking {
            return NextBookingEntry(date: Date(), state: .hasBooking(booking))
        }

        return NextBookingEntry(date: Date(), state: .noBooking)
    }

    private func parseBookingDateTime(date dateStr: String, time timeStr: String) -> Date? {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd'T'HH:mm:ss.SSSZ"
        formatter.locale = Locale(identifier: "sv_SE")

        guard let bookingDate = formatter.date(from: dateStr) else { return nil }

        let calendar = Calendar.current
        let components = timeStr.split(separator: ":").compactMap { Int($0) }
        guard components.count >= 2 else { return nil }

        return calendar.date(
            bySettingHour: components[0],
            minute: components[1],
            second: 0,
            of: bookingDate
        )
    }
}
