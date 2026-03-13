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

                VStack(spacing: 4) {
                    Text(dayAbbreviation(for: date))
                        .font(.caption2)
                        .foregroundStyle(isSelected ? Color.accentColor : .secondary)
                        .fontWeight(isToday ? .bold : .regular)

                    ZStack {
                        Circle()
                            .fill(Color.accentColor)
                            .frame(width: 34, height: 34)
                            .opacity(isSelected ? 1 : 0)

                        Text("\(calendar.component(.day, from: date))")
                            .font(.subheadline)
                            .fontWeight(isSelected || isToday ? .bold : .regular)
                            .foregroundStyle(isSelected ? .white : isToday ? .accentColor : .primary)
                    }
                    .frame(width: 34, height: 34)
                }
                .frame(maxWidth: .infinity, minHeight: 56)
                .onTapGesture {
                    onSelectDate(date)
                }
                .accessibilityElement(children: .ignore)
                .accessibilityLabel("\(dayName(for: date)), \(calendar.component(.day, from: date))")
                .accessibilityAddTraits(isSelected ? [.isButton, .isSelected] : .isButton)
            }
        }
        .padding(.horizontal, 4)
        .padding(.vertical, 8)
        .background(Color(.systemBackground))
    }

    // MARK: - Helpers

    private func dayAbbreviation(for date: Date) -> String {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "sv_SE")
        formatter.dateFormat = "EEE"
        return formatter.string(from: date).prefix(3).uppercased()
    }

    private func dayName(for date: Date) -> String {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "sv_SE")
        formatter.dateFormat = "EEEE"
        return formatter.string(from: date)
    }
}
#endif
