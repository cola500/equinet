//
//  WeekStripView.swift
//  Equinet
//
//  7-day strip above the calendar time grid. Shows day name + date number.
//  Active day is highlighted with accent color. Tap navigates to that day.
//  Follows Apple Calendar's week strip pattern (Mon-Sun).
//

#if os(iOS)
import SwiftUI

struct WeekStripView: View {
    let selectedDate: Date
    let onSelectDate: (Date) -> Void
    var exceptionForDate: ((Date) -> NativeException?)? = nil

    private let calendar = Calendar.current

    /// Compute Mon-Sun week containing selectedDate
    private var weekDates: [Date] {
        var cal = Calendar.current
        cal.firstWeekday = 2  // Monday
        let day = cal.startOfDay(for: selectedDate)
        guard let weekInterval = cal.dateInterval(of: .weekOfYear, for: day) else {
            return [day]
        }
        let monday = cal.startOfDay(for: weekInterval.start)
        return (0..<7).compactMap { offset in
            cal.date(byAdding: .day, value: offset, to: monday)
        }
    }

    var body: some View {
        HStack(spacing: 0) {
            ForEach(weekDates, id: \.self) { date in
                let isSelected = calendar.isDate(date, inSameDayAs: selectedDate)
                let isToday = calendar.isDateInToday(date)

                Button {
                    onSelectDate(date)
                } label: {
                    VStack(spacing: 4) {
                        Text(dayAbbreviation(for: date))
                            .font(.caption2)
                            .foregroundStyle(isSelected ? Color.equinetGreen : .secondary)
                            .fontWeight(isToday ? .bold : .regular)

                        ZStack {
                            Circle()
                                .fill(Color.equinetGreen)
                                .frame(width: 34, height: 34)
                                .opacity(isSelected ? 1 : 0)

                            Text("\(calendar.component(.day, from: date))")
                                .font(.subheadline)
                                .fontWeight(isSelected || isToday ? .bold : .regular)
                                .foregroundStyle(isSelected ? .white : isToday ? Color.equinetGreen : .primary)
                        }
                        .frame(width: 34, height: 34)

                        // Exception indicator dot
                        if let exc = exceptionForDate?(date) {
                            Circle()
                                .fill(exc.isClosed ? .red : .blue)
                                .frame(width: 5, height: 5)
                        } else {
                            // Spacer to maintain consistent height
                            Color.clear.frame(width: 5, height: 5)
                        }
                    }
                    .frame(maxWidth: .infinity, minHeight: 56)
                }
                .buttonStyle(.plain)
                .accessibilityElement(children: .ignore)
                .accessibilityLabel(dayAccessibilityLabel(for: date, isSelected: isSelected, isToday: isToday))
                .accessibilityAddTraits(isSelected ? [.isSelected] : [])
            }
        }
        .padding(.horizontal, 4)
        .padding(.vertical, 8)
        .background(Color(.systemBackground))
    }

    // MARK: - Static DateFormatters

    private static let accessibilityDateFormatter: DateFormatter = {
        let f = DateFormatter()
        f.locale = Locale(identifier: "sv_SE")
        f.dateFormat = "EEEE d MMMM"
        return f
    }()

    private static let abbreviationFormatter: DateFormatter = {
        let f = DateFormatter()
        f.locale = Locale(identifier: "sv_SE")
        f.dateFormat = "EEE"
        return f
    }()

    private static let dayNameFormatter = EquinetDateFormatters.swedishDayName

    // MARK: - Helpers

    private func dayAbbreviation(for date: Date) -> String {
        Self.abbreviationFormatter.string(from: date).prefix(3).uppercased()
    }

    private func dayName(for date: Date) -> String {
        Self.dayNameFormatter.string(from: date)
    }

    private func dayAccessibilityLabel(for date: Date, isSelected: Bool, isToday: Bool) -> String {
        var label = Self.accessibilityDateFormatter.string(from: date)
        if isToday { label += ", idag" }
        if isSelected { label += ", vald" }
        if let exc = exceptionForDate?(date) {
            label += exc.isClosed ? ", stängd" : ", ändrade tider"
        }
        return label
    }
}
#endif
