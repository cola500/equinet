//
//  WeekStripView.swift
//  Equinet
//
//  7-day strip above the calendar time grid. Shows day name + date number.
//  Active day is highlighted with accent color. Tap navigates to that day.
//  Follows Apple Calendar's week strip pattern.
//

#if os(iOS)
import SwiftUI

struct WeekStripView: View {
    let dates: [Date]
    let selectedDate: Date
    let onSelectDate: (Date) -> Void

    private let calendar = Calendar.current

    var body: some View {
        HStack(spacing: 0) {
            ForEach(dates, id: \.self) { date in
                dayCircle(for: date)
                    .frame(maxWidth: .infinity)
                    .onTapGesture {
                        onSelectDate(date)
                    }
            }
        }
        .padding(.horizontal, 4)
        .padding(.vertical, 8)
        .background(Color(.systemBackground))
    }

    private func dayCircle(for date: Date) -> some View {
        let isSelected = calendar.isDate(date, inSameDayAs: selectedDate)
        let isToday = calendar.isDateInToday(date)

        return VStack(spacing: 4) {
            Text(dayAbbreviation(for: date))
                .font(.caption2)
                .foregroundStyle(isSelected ? Color.accentColor : .secondary)
                .fontWeight(isToday ? .bold : .regular)

            ZStack {
                if isSelected {
                    Circle()
                        .fill(Color.accentColor)
                        .frame(width: 34, height: 34)
                }

                Text("\(calendar.component(.day, from: date))")
                    .font(.subheadline)
                    .fontWeight(isSelected || isToday ? .bold : .regular)
                    .foregroundStyle(isSelected ? .white : isToday ? .accentColor : .primary)
            }
            .frame(width: 34, height: 34)
        }
        .frame(minWidth: 44, minHeight: 56)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(dayName(for: date)), \(calendar.component(.day, from: date))")
        .accessibilityAddTraits(isSelected ? [.isButton, .isSelected] : .isButton)
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
