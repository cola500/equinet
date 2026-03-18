//
//  NativeCalendarView.swift
//  Equinet
//
//  Native SwiftUI day calendar with swipe navigation, time grid,
//  booking blocks, now-line, and availability overlay.
//

#if os(iOS)
import Combine
import OSLog
import SwiftUI

struct NativeCalendarView: View {
    @Bindable var viewModel: CalendarViewModel
    var onNavigateToBooking: ((_ bookingId: String) -> Void)?
    var onNavigateToWeb: ((_ path: String) -> Void)?
    @State private var selectedBooking: NativeBooking?
    @State private var newBookingTime: (date: Date, time: String)?
    @State private var exceptionSheetDate: Date?

    // Time grid constants (matches web: 08:00-18:00)
    private let startHour = 8
    private let endHour = 18
    private let hourHeight: CGFloat = 64  // h-16 equivalent
    private let hours: [Int] = Array(8...18)

    private let calendar = Calendar.current

    /// The displayed date -- driven by @State, bound as TabView selection.
    /// Single source of truth for header, week strip, AND page swiping.
    @State private var displayedDate: Date = Calendar.current.startOfDay(for: .now)

    /// Current time for now-line rendering, updated every 60s
    @State private var currentTime = Date()
    private let nowTimer = Timer.publish(every: 60, on: .main, in: .common).autoconnect()

    var body: some View {
        VStack(spacing: 0) {
            // Date header -- bound to @State displayedDate
            dateHeader

            // Week strip (7 day circles) -- bound to @State displayedDate
            WeekStripView(
                selectedDate: displayedDate,
                onSelectDate: { date in
                    let day = calendar.startOfDay(for: date)
                    withAnimation { displayedDate = day }
                    viewModel.navigateToDay(date)
                    UIImpactFeedbackGenerator(style: .light).impactOccurred()
                },
                exceptionForDate: { viewModel.exceptionForDate($0) }
            )

            Divider()

            // Service filter pills
            if !viewModel.availableServices.isEmpty {
                serviceFilterBar
            }

            // Exception info badge (reason + location)
            if let exc = viewModel.exceptionForDate(displayedDate) {
                exceptionBadge(exc)
            }

            // Offline banner
            if viewModel.isOffline {
                offlineBanner
            }

            // Error state
            if let error = viewModel.error {
                errorView(error)
                    .transition(.opacity)
            } else if viewModel.isLoading && viewModel.bookings.isEmpty {
                // Loading state (first load only)
                VStack {
                    Spacer()
                    ProgressView("Laddar kalender...")
                        .font(.subheadline)
                    Spacer()
                }
                .frame(maxWidth: .infinity)
                .transition(.opacity)
            } else {
                // Page-style TabView for day swipe navigation.
                // Using TabView(selection:) instead of ScrollView+scrollPosition
                // because TabView selection binding directly drives @State,
                // guaranteeing visual updates for header and week strip.
                TabView(selection: $displayedDate) {
                    ForEach(viewModel.dateRange, id: \.self) { date in
                        ScrollView(.vertical) {
                            ZStack(alignment: .topLeading) {
                                availabilityOverlay(for: date)
                                timeGrid
                                timeSlotTapOverlay(for: date)
                                bookingBlocks(for: date)
                                if calendar.isDateInToday(date) { nowLine }

                                // Empty state overlay
                                if viewModel.bookingsForDate(date).isEmpty && !viewModel.isLoading {
                                    VStack(spacing: 8) {
                                        Spacer()
                                            .frame(height: CGFloat(hours.count / 2) * hourHeight - 40)
                                        Text("Inga bokningar den här dagen")
                                            .font(.subheadline)
                                            .foregroundStyle(.secondary)
                                    }
                                    .frame(maxWidth: .infinity)
                                }
                            }
                            .frame(height: CGFloat(hours.count) * hourHeight)
                        }
                        .refreshable {
                            viewModel.refresh()
                        }
                        .tag(date)
                    }
                }
                .tabViewStyle(.page(indexDisplayMode: .never))
                .onChange(of: displayedDate) { _, newDate in
                    // Sync ViewModel for data fetching when page changes
                    if !calendar.isDate(newDate, inSameDayAs: viewModel.selectedDate) {
                        viewModel.navigateToDay(newDate)
                        UIImpactFeedbackGenerator(style: .light).impactOccurred()
                    }
                }
            }
        }
        .onReceive(nowTimer) { currentTime = $0 }
        .animation(.easeInOut(duration: 0.25), value: viewModel.error)
        .animation(.easeInOut(duration: 0.25), value: viewModel.isLoading)
        .onAppear {
            displayedDate = calendar.startOfDay(for: viewModel.selectedDate)
            viewModel.loadDataForSelectedDate()
        }
        .confirmationDialog(
            newBookingDialogTitle,
            isPresented: Binding(
                get: { newBookingTime != nil },
                set: { if !$0 { newBookingTime = nil } }
            )
        ) {
            Button("Skapa bokning") {
                if let booking = newBookingTime {
                    let dateStr = Self.isoDateFormatter.string(from: booking.date)
                    onNavigateToWeb?("/provider/calendar?newBooking=true&date=\(dateStr)&time=\(booking.time)")
                    newBookingTime = nil
                }
            }
            Button("Avbryt", role: .cancel) {
                newBookingTime = nil
            }
        }
        .sheet(item: $selectedBooking) { booking in
            BookingDetailSheet(
                booking: booking,
                onAction: { bookingId, newStatus in
                    viewModel.updateBookingStatus(bookingId: bookingId, newStatus: newStatus)
                },
                onOpenInApp: { bookingId in
                    onNavigateToBooking?(bookingId)
                }
            )
            .presentationDetents([.medium, .large])
        }
        .sheet(isPresented: Binding(
            get: { exceptionSheetDate != nil },
            set: { if !$0 { exceptionSheetDate = nil } }
        )) {
            if let date = exceptionSheetDate {
                ExceptionFormSheet(
                    date: date,
                    existingException: viewModel.exceptionForDate(date),
                    onSave: { request in viewModel.saveException(request) },
                    onDelete: { dateStr in viewModel.deleteException(date: dateStr) }
                )
            }
        }
    }

    // MARK: - Date Header

    /// Uses @State displayedDate for visual rendering (not @Observable viewModel)
    private var dateHeader: some View {
        HStack {
            // Previous day
            Button {
                navigateDay(by: -1)
            } label: {
                Image(systemName: "chevron.left")
                    .font(.title3)
                    .frame(minWidth: 44, minHeight: 44)
            }

            Spacer()

            VStack(spacing: 2) {
                Text(dayName(for: displayedDate))
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .textCase(.uppercase)
                Text(formattedDate(displayedDate))
                    .font(.title3)
                    .fontWeight(.semibold)
            }

            Spacer()

            // Exception button -- opens form to add/edit availability exception
            Button {
                exceptionSheetDate = displayedDate
            } label: {
                Image(systemName: viewModel.exceptionForDate(displayedDate) != nil
                    ? "moon.zzz.fill" : "moon.zzz")
                    .font(.title3)
                    .foregroundStyle(viewModel.exceptionForDate(displayedDate) != nil
                        ? Color.orange : .secondary)
                    .frame(minWidth: 44, minHeight: 44)
            }

            // Today button -- always present to prevent layout shift, hidden when already today
            Button {
                let today = calendar.startOfDay(for: .now)
                withAnimation { displayedDate = today }
                viewModel.goToToday()
                UIImpactFeedbackGenerator(style: .medium).impactOccurred()
            } label: {
                Text("Idag")
                    .font(.subheadline)
                    .fontWeight(.medium)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 6)
                    .background(Color.equinetGreen.opacity(0.1))
                    .clipShape(Capsule())
            }
            .opacity(calendar.isDateInToday(displayedDate) ? 0 : 1)
            .disabled(calendar.isDateInToday(displayedDate))

            Button {
                navigateDay(by: 1)
            } label: {
                Image(systemName: "chevron.right")
                    .font(.title3)
                    .frame(minWidth: 44, minHeight: 44)
            }
        }
        .padding(.horizontal)
        .padding(.vertical, 8)
        .background(Color(.systemBackground))
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(dayName(for: displayedDate)), \(formattedDate(displayedDate))")
        .accessibilityAdjustableAction { direction in
            switch direction {
            case .increment:
                navigateDay(by: 1)
            case .decrement:
                navigateDay(by: -1)
            @unknown default:
                break
            }
        }
    }

    // MARK: - Time Grid

    private var timeGrid: some View {
        VStack(spacing: 0) {
            ForEach(hours, id: \.self) { hour in
                HStack(alignment: .top, spacing: 0) {
                    // Time label
                    Text(String(format: "%02d:00", hour))
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                        .frame(width: 44, alignment: .trailing)
                        .padding(.trailing, 8)
                        .offset(y: -6)

                    // Grid line + area
                    VStack(spacing: 0) {
                        Divider()
                        Spacer()
                    }
                }
                .frame(height: hourHeight)
            }
        }
    }

    // MARK: - Booking Blocks

    private func bookingBlocks(for date: Date) -> some View {
        let dayBookings = viewModel.bookingsForDate(date)
        return ForEach(dayBookings) { booking in
            bookingBlock(booking)
                .overlay {
                    if viewModel.actionInProgress == booking.id {
                        RoundedRectangle(cornerRadius: 6)
                            .fill(.ultraThinMaterial)
                            .overlay(ProgressView())
                    }
                }
                .onTapGesture {
                    UIImpactFeedbackGenerator(style: .light).impactOccurred()
                    selectedBooking = booking
                }
                .contextMenu {
                    if booking.status == "pending" {
                        Button {
                            viewModel.updateBookingStatus(bookingId: booking.id, newStatus: "confirmed")
                        } label: {
                            Label("Bekräfta", systemImage: "checkmark.circle")
                        }

                        Button(role: .destructive) {
                            viewModel.updateBookingStatus(bookingId: booking.id, newStatus: "cancelled")
                        } label: {
                            Label("Avvisa", systemImage: "xmark.circle")
                        }
                    }
                }
        }
    }

    private func bookingBlock(_ booking: NativeBooking) -> some View {
        let top = timePosition(booking.startTime)
        let bottom = timePosition(booking.endTime)
        let height = max(bottom - top, 28) // Min height 28pt

        return HStack(spacing: 6) {
            // Color bar
            RoundedRectangle(cornerRadius: 2)
                .fill(statusColor(booking))
                .frame(width: 4)

            VStack(alignment: .leading, spacing: 2) {
                Text(booking.serviceName)
                    .font(.caption)
                    .fontWeight(.semibold)
                    .lineLimit(1)

                if let horse = booking.horseName {
                    Text(horse)
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                }

                Text(booking.customerFullName)
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }

            Spacer()

            // Status indicators
            VStack(spacing: 2) {
                if booking.bookingSeriesId != nil {
                    Image(systemName: "arrow.triangle.2.circlepath")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }
                if booking.isPaid {
                    Image(systemName: "creditcard.fill")
                        .font(.caption2)
                        .foregroundStyle(.green)
                }
                if booking.isManualBooking {
                    Text("M")
                        .font(.system(size: 9, weight: .bold))
                        .foregroundStyle(.secondary)
                }
            }
        }
        .padding(.horizontal, 6)
        .padding(.vertical, 4)
        .background(statusBackgroundColor(booking))
        .clipShape(RoundedRectangle(cornerRadius: 6))
        .overlay(
            RoundedRectangle(cornerRadius: 6)
                .stroke(statusColor(booking), lineWidth: 1)
        )
        .padding(.leading, 56) // After time labels
        .padding(.trailing, 8)
        .offset(y: top)
        .frame(height: height)
        .accessibilityElement(children: .combine)
        .accessibilityLabel(bookingAccessibilityLabel(booking))
        .accessibilityHint("Dubbelklicka för detaljer")
        .accessibilityAddTraits(.isButton)
    }

    // MARK: - Now Line

    private var nowLine: some View {
        let hour = calendar.component(.hour, from: currentTime)
        let minute = calendar.component(.minute, from: currentTime)
        let position = timePositionFromComponents(hour: hour, minute: minute)

        return HStack(spacing: 0) {
            Spacer().frame(width: 44)

            Circle()
                .fill(.red)
                .frame(width: 8, height: 8)

            Rectangle()
                .fill(.red)
                .frame(height: 1.5)
        }
        .offset(y: position - 4) // Center the circle on the line
        .accessibilityLabel("Nuvarande tid, klockan \(String(format: "%02d:%02d", hour, minute))")
        .accessibilityAddTraits(.updatesFrequently)
    }

    // MARK: - Availability Overlay

    private func availabilityOverlay(for date: Date) -> some View {
        let weekday = calendarWeekday(for: date)
        let exception = viewModel.exceptionForDate(date)
        let avail = viewModel.availabilityForWeekday(weekday)

        // Determine open hours
        let isClosed: Bool
        let openStart: String?
        let openEnd: String?

        if let exc = exception {
            isClosed = exc.isClosed
            openStart = exc.startTime
            openEnd = exc.endTime
        } else if let a = avail {
            isClosed = a.isClosed
            openStart = a.startTime
            openEnd = a.endTime
        } else {
            isClosed = true
            openStart = nil
            openEnd = nil
        }

        return ZStack(alignment: .topLeading) {
            if isClosed {
                // Full day closed
                Rectangle()
                    .fill(Color.gray.opacity(0.08))
                    .frame(height: CGFloat(hours.count) * hourHeight)
            } else if let start = openStart, let end = openEnd {
                let startPos = timePosition(start)
                let endPos = timePosition(end)

                // Before opening
                if startPos > 0 {
                    Rectangle()
                        .fill(Color.gray.opacity(0.08))
                        .frame(height: startPos)
                }
                // Open hours
                Rectangle()
                    .fill(Color.green.opacity(0.04))
                    .offset(y: startPos)
                    .frame(height: endPos - startPos)
                // After closing
                let totalHeight = CGFloat(hours.count) * hourHeight
                if endPos < totalHeight {
                    Rectangle()
                        .fill(Color.gray.opacity(0.08))
                        .offset(y: endPos)
                        .frame(height: totalHeight - endPos)
                }
            }
        }
        .padding(.leading, 52) // After time labels
    }

    // MARK: - Error View

    private func errorView(_ message: String) -> some View {
        VStack(spacing: 12) {
            Spacer()
            Image(systemName: "exclamationmark.triangle")
                .font(.system(size: 36))
                .foregroundStyle(.secondary)
            Text(message)
                .font(.body)
                .foregroundStyle(.secondary)
            Button("Försök igen") {
                viewModel.refresh()
            }
            .buttonStyle(.borderedProminent)
            .frame(minHeight: 44)
            Spacer()
        }
        .frame(maxWidth: .infinity)
    }

    // MARK: - Service Filter Bar

    private var serviceFilterBar: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                // "Alla" pill
                filterPill(label: "Alla", isSelected: viewModel.selectedServiceFilter == nil) {
                    viewModel.selectedServiceFilter = nil
                }

                ForEach(viewModel.availableServices, id: \.id) { service in
                    filterPill(
                        label: service.name,
                        isSelected: viewModel.selectedServiceFilter == service.id
                    ) {
                        viewModel.selectedServiceFilter = service.id
                    }
                }
            }
            .padding(.horizontal)
            .padding(.vertical, 6)
        }
        .background(Color(.systemBackground))
    }

    private func filterPill(label: String, isSelected: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(label)
                .font(.subheadline)
                .fontWeight(isSelected ? .semibold : .regular)
                .padding(.horizontal, 12)
                .padding(.vertical, 6)
                .background(isSelected ? Color.equinetGreen : Color(.systemGray5))
                .foregroundStyle(isSelected ? .white : .primary)
                .clipShape(Capsule())
        }
        .frame(minHeight: 44)
    }

    // MARK: - Offline Banner

    private var offlineBanner: some View {
        HStack(spacing: 6) {
            Image(systemName: "wifi.slash")
                .font(.caption)
            Text("Offline -- visar cachad data")
                .font(.caption)
                .fontWeight(.medium)
        }
        .foregroundStyle(.white)
        .frame(maxWidth: .infinity)
        .padding(.vertical, 6)
        .background(Color.orange)
    }

    // MARK: - Exception Badge

    private func exceptionBadge(_ exc: NativeException) -> some View {
        HStack(spacing: 6) {
            if exc.isClosed, let reason = exc.reason, !reason.isEmpty {
                Label(reason, systemImage: "moon.zzz")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            } else if exc.isClosed {
                Label("Stängd", systemImage: "moon.zzz")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            if let location = exc.location, !location.isEmpty {
                Label(location, systemImage: "mappin.circle")
                    .font(.caption)
                    .foregroundStyle(.blue)
            }
        }
        .padding(.horizontal)
        .padding(.vertical, 4)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color(.systemGray6))
    }

    // MARK: - Accessibility Helpers

    private func bookingAccessibilityLabel(_ booking: NativeBooking) -> String {
        var parts = [booking.serviceName]
        parts.append("klockan \(booking.startTime) till \(booking.endTime)")
        parts.append(booking.customerFullName)
        if let horse = booking.horseName {
            parts.append(horse)
        }
        let statusText: String
        switch booking.status {
        case "pending": statusText = "väntande"
        case "confirmed": statusText = "bekräftad"
        case "completed": statusText = "slutförd"
        case "cancelled": statusText = "avbokad"
        case "no_show": statusText = "utebliven"
        default: statusText = booking.status
        }
        parts.append(statusText)
        if booking.isPaid { parts.append("betald") }
        return parts.joined(separator: ", ")
    }

    // MARK: - Tap-to-Book

    private var newBookingDialogTitle: String {
        guard let booking = newBookingTime else { return "" }
        return "Ny bokning \(Self.shortDateFormatter.string(from: booking.date)) kl \(booking.time)?"
    }

    private func timeSlotTapOverlay(for date: Date) -> some View {
        let totalHeight = CGFloat(hours.count) * hourHeight
        return Color.clear
            .frame(height: totalHeight)
            .padding(.leading, 52)
            .contentShape(Rectangle())
            .onTapGesture { location in
                let time = timeFromTapPosition(location.y)
                UIImpactFeedbackGenerator(style: .light).impactOccurred()
                newBookingTime = (date: date, time: time)
            }
    }

    /// Convert Y position to "HH:mm" snapped to nearest 15 min
    private func timeFromTapPosition(_ localY: CGFloat) -> String {
        let totalHeight = CGFloat(hours.count) * hourHeight
        let clamped = max(0, min(localY, totalHeight))
        let totalMinutes = (clamped / totalHeight) * CGFloat(hours.count) * 60
        let snapped = Int(round(totalMinutes / 15)) * 15
        let hour = startHour + snapped / 60
        let minute = snapped % 60
        return String(format: "%02d:%02d", min(hour, endHour), minute)
    }


    // MARK: - Time Position Helpers

    /// Convert "HH:mm" to Y offset in points
    private func timePosition(_ time: String) -> CGFloat {
        let parts = time.split(separator: ":").compactMap { Int($0) }
        guard parts.count >= 2 else { return 0 }
        return timePositionFromComponents(hour: parts[0], minute: parts[1])
    }

    private func timePositionFromComponents(hour: Int, minute: Int) -> CGFloat {
        let totalMinutes = CGFloat(hour * 60 + minute)
        let startMinutes = CGFloat(startHour * 60) // 480
        let range = CGFloat((endHour - startHour) * 60) // 600
        let fraction = (totalMinutes - startMinutes) / range
        let totalHeight = CGFloat(hours.count) * hourHeight
        return max(0, min(totalHeight, fraction * totalHeight))
    }

    // MARK: - Status Colors

    private func statusColor(_ booking: NativeBooking) -> Color {
        if booking.isPaid { return .green }
        switch booking.status {
        case "pending": return .yellow
        case "confirmed": return .green
        case "completed": return .blue
        case "cancelled": return .red
        case "no_show": return .orange
        default: return .gray
        }
    }

    private func statusBackgroundColor(_ booking: NativeBooking) -> Color {
        if booking.isPaid { return Color(.systemGreen).opacity(0.1) }
        switch booking.status {
        case "pending": return Color(.systemYellow).opacity(0.1)
        case "confirmed": return Color(.systemGreen).opacity(0.08)
        case "completed": return Color(.systemBlue).opacity(0.1)
        case "cancelled": return Color(.systemRed).opacity(0.1)
        case "no_show": return Color(.systemOrange).opacity(0.1)
        default: return Color(.systemGray).opacity(0.1)
        }
    }

    // MARK: - Date Helpers

    /// Convert Date to our weekday format (0=Monday, 6=Sunday)
    private func calendarWeekday(for date: Date) -> Int {
        let weekday = calendar.component(.weekday, from: date)
        // Calendar.weekday: 1=Sunday, 2=Monday, ...
        return weekday == 1 ? 6 : weekday - 2
    }

    private func navigateDay(by days: Int) {
        guard let newDate = calendar.date(byAdding: .day, value: days, to: displayedDate) else { return }
        let day = calendar.startOfDay(for: newDate)
        withAnimation { displayedDate = day }
        viewModel.navigateToDay(newDate)
        UIImpactFeedbackGenerator(style: .light).impactOccurred()
    }

    // MARK: - Static DateFormatters (avoid per-render allocation)

    private static let dayNameFormatter: DateFormatter = {
        let f = DateFormatter()
        f.locale = Locale(identifier: "sv_SE")
        f.dateFormat = "EEEE"
        return f
    }()

    private static let fullDateFormatter: DateFormatter = {
        let f = DateFormatter()
        f.locale = Locale(identifier: "sv_SE")
        f.dateFormat = "d MMMM yyyy"
        return f
    }()

    private static let shortDateFormatter: DateFormatter = {
        let f = DateFormatter()
        f.locale = Locale(identifier: "sv_SE")
        f.dateFormat = "d MMMM"
        return f
    }()

    private static let isoDateFormatter: DateFormatter = {
        let f = DateFormatter()
        f.dateFormat = "yyyy-MM-dd"
        return f
    }()

    private func dayName(for date: Date) -> String {
        Self.dayNameFormatter.string(from: date)
    }

    private func formattedDate(_ date: Date) -> String {
        Self.fullDateFormatter.string(from: date)
    }
}

#endif
