//
//  NativeCalendarView.swift
//  Equinet
//
//  Native SwiftUI day calendar with swipe navigation, time grid,
//  booking blocks, now-line, and availability overlay.
//

#if os(iOS)
import OSLog
import SwiftUI

struct NativeCalendarView: View {
    @Bindable var viewModel: CalendarViewModel
    var onNavigateToWeb: ((_ path: String) -> Void)?
    @State private var selectedBooking: NativeBooking?
    @State private var swipeDirection: Edge = .trailing

    // Time grid constants (matches web: 08:00-18:00)
    private let startHour = 8
    private let endHour = 18
    private let hourHeight: CGFloat = 64  // h-16 equivalent
    private let hours: [Int] = Array(8...18)

    private let calendar = Calendar.current

    var body: some View {
        VStack(spacing: 0) {
            // Date header
            dateHeader

            // Service filter pills
            if !viewModel.availableServices.isEmpty {
                serviceFilterBar
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
                // Day view with UIKit swipe recognizers (SwiftUI gestures can't compete with ScrollView)
                dayView(for: viewModel.selectedDate)
                    .id(viewModel.selectedDate)
                    .transition(.asymmetric(
                        insertion: .move(edge: swipeDirection),
                        removal: .move(edge: swipeDirection == .trailing ? .leading : .trailing)
                    ))
            }
        }
        .animation(.easeInOut(duration: 0.25), value: viewModel.error)
        .animation(.easeInOut(duration: 0.25), value: viewModel.isLoading)
        .onAppear {
            viewModel.loadDataForSelectedDate()
        }
        .sheet(item: $selectedBooking) { booking in
            BookingDetailSheet(
                booking: booking,
                onAction: { bookingId, newStatus in
                    viewModel.updateBookingStatus(bookingId: bookingId, newStatus: newStatus)
                },
                onOpenInApp: { bookingId in
                    onNavigateToWeb?("/provider/bookings/\(bookingId)")
                }
            )
            .presentationDetents([.medium, .large])
        }
    }

    // MARK: - Date Header

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
                Text(dayName(for: viewModel.selectedDate))
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .textCase(.uppercase)
                Text(formattedDate(viewModel.selectedDate))
                    .font(.title3)
                    .fontWeight(.semibold)
            }

            Spacer()

            // Today button or next day
            if !calendar.isDateInToday(viewModel.selectedDate) {
                Button {
                    withAnimation(.easeInOut(duration: 0.25)) {
                        swipeDirection = .leading
                        viewModel.goToToday()
                    }
                    UIImpactFeedbackGenerator(style: .medium).impactOccurred()
                } label: {
                    Text("Idag")
                        .font(.subheadline)
                        .fontWeight(.medium)
                        .padding(.horizontal, 12)
                        .padding(.vertical, 6)
                        .background(Color.accentColor.opacity(0.1))
                        .clipShape(Capsule())
                }
            }

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
        .accessibilityLabel("\(dayName(for: viewModel.selectedDate)), \(formattedDate(viewModel.selectedDate))")
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

    // MARK: - Day View (UIKit UIScrollView with swipe gesture recognizers)

    private func dayView(for date: Date) -> some View {
        SwipeableScrollView(
            content: {
                ZStack(alignment: .topLeading) {
                    // Availability overlay (behind everything)
                    availabilityOverlay(for: date)

                    // Time grid lines
                    timeGrid

                    // Booking blocks
                    bookingBlocks(for: date)

                    // Now line
                    if calendar.isDateInToday(date) {
                        nowLine
                    }
                }
                .frame(height: CGFloat(hours.count) * hourHeight)
            },
            onSwipe: { direction in
                withAnimation(.easeInOut(duration: 0.25)) {
                    if direction == .left {
                        swipeDirection = .trailing
                        navigateDay(by: 1)
                    } else if direction == .right {
                        swipeDirection = .leading
                        navigateDay(by: -1)
                    }
                }
            },
            onRefresh: {
                viewModel.refresh()
            }
        )
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
        let now = Date()
        let hour = calendar.component(.hour, from: now)
        let minute = calendar.component(.minute, from: now)
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
                .background(isSelected ? Color.accentColor : Color(.systemGray5))
                .foregroundStyle(isSelected ? .white : .primary)
                .clipShape(Capsule())
        }
        .frame(minHeight: 36)
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
        let newDate = calendar.date(byAdding: .day, value: days, to: viewModel.selectedDate)!
        viewModel.navigateToDay(newDate)
        UIImpactFeedbackGenerator(style: .light).impactOccurred()
    }

    private func dayName(for date: Date) -> String {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "sv_SE")
        formatter.dateFormat = "EEEE"
        return formatter.string(from: date)
    }

    private func formattedDate(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "sv_SE")
        formatter.dateFormat = "d MMMM yyyy"
        return formatter.string(from: date)
    }
}

// MARK: - SwipeableScrollView (UIKit-backed scroll with UIPanGestureRecognizer direction detection)

/// Replaces SwiftUI ScrollView with UIKit UIScrollView + UIPanGestureRecognizer.
/// Uses gestureRecognizerShouldBegin to disambiguate horizontal swipes (day navigation)
/// from vertical scroll BEFORE any recognizer claims the touch.
/// scrollView.panGestureRecognizer.require(toFail:) ensures UIScrollView waits for our decision.
private struct SwipeableScrollView<Content: View>: UIViewRepresentable {
    @ViewBuilder var content: () -> Content
    var onSwipe: (UISwipeGestureRecognizer.Direction) -> Void
    var onRefresh: (() -> Void)?

    func makeCoordinator() -> Coordinator { Coordinator(onSwipe: onSwipe, onRefresh: onRefresh) }

    func makeUIView(context: Context) -> UIScrollView {
        let scrollView = UIScrollView()
        scrollView.alwaysBounceVertical = true
        scrollView.showsVerticalScrollIndicator = true

        // Horizontal pan recognizer with direction detection in gestureRecognizerShouldBegin
        let horizontalPan = UIPanGestureRecognizer(
            target: context.coordinator,
            action: #selector(Coordinator.handleHorizontalPan)
        )
        horizontalPan.delegate = context.coordinator
        scrollView.addGestureRecognizer(horizontalPan)
        context.coordinator.horizontalPan = horizontalPan

        // CRITICAL: Make scroll view's pan wait for our recognizer's decision
        scrollView.panGestureRecognizer.require(toFail: horizontalPan)

        // Pull-to-refresh
        if onRefresh != nil {
            let rc = UIRefreshControl()
            rc.addTarget(context.coordinator, action: #selector(Coordinator.handleRefresh), for: .valueChanged)
            scrollView.refreshControl = rc
        }

        // Host SwiftUI content
        let host = UIHostingController(rootView: content())
        host.view.backgroundColor = .clear
        scrollView.addSubview(host.view)
        context.coordinator.hostController = host

        AppLogger.calendar.debug("SwipeableScrollView: created with horizontal pan gesture")
        return scrollView
    }

    func updateUIView(_ scrollView: UIScrollView, context: Context) {
        context.coordinator.hostController?.rootView = content()
        layoutContent(in: scrollView, context: context)
        // End refresh animation if still spinning
        if scrollView.refreshControl?.isRefreshing == true {
            scrollView.refreshControl?.endRefreshing()
        }
    }

    private func layoutContent(in scrollView: UIScrollView, context: Context) {
        guard let hostView = context.coordinator.hostController?.view else { return }
        let width = scrollView.bounds.width
        guard width > 0 else { return }
        let size = hostView.sizeThatFits(CGSize(width: width, height: .greatestFiniteMagnitude))
        hostView.frame = CGRect(origin: .zero, size: CGSize(width: width, height: size.height))
        scrollView.contentSize = CGSize(width: width, height: size.height)
    }

    class Coordinator: NSObject, UIGestureRecognizerDelegate {
        let onSwipe: (UISwipeGestureRecognizer.Direction) -> Void
        let onRefresh: (() -> Void)?
        var hostController: UIHostingController<Content>?
        var horizontalPan: UIPanGestureRecognizer?

        init(onSwipe: @escaping (UISwipeGestureRecognizer.Direction) -> Void, onRefresh: (() -> Void)?) {
            self.onSwipe = onSwipe
            self.onRefresh = onRefresh
        }

        // Called BEFORE the gesture begins -- decide direction here
        func gestureRecognizerShouldBegin(_ gestureRecognizer: UIGestureRecognizer) -> Bool {
            guard let pan = gestureRecognizer as? UIPanGestureRecognizer,
                  pan === horizontalPan else { return true }
            let velocity = pan.velocity(in: pan.view)
            let isHorizontal = abs(velocity.x) > abs(velocity.y) * 1.5
            AppLogger.calendar.debug("SwipeableScrollView: shouldBegin vx=\(velocity.x, privacy: .public) vy=\(velocity.y, privacy: .public) horizontal=\(isHorizontal, privacy: .public)")
            return isHorizontal
        }

        // Allow long-press (context menu) to work simultaneously
        func gestureRecognizer(
            _ gestureRecognizer: UIGestureRecognizer,
            shouldRecognizeSimultaneouslyWith other: UIGestureRecognizer
        ) -> Bool {
            return other is UILongPressGestureRecognizer
        }

        @objc func handleHorizontalPan(_ gesture: UIPanGestureRecognizer) {
            guard gesture.state == .ended || gesture.state == .cancelled else { return }
            let velocity = gesture.velocity(in: gesture.view)
            let translation = gesture.translation(in: gesture.view)
            let translationThreshold: CGFloat = 50
            let velocityThreshold: CGFloat = 500

            if translation.x < -translationThreshold || velocity.x < -velocityThreshold {
                AppLogger.calendar.debug("SwipeableScrollView: horizontal pan -> left (next day)")
                onSwipe(.left)
            } else if translation.x > translationThreshold || velocity.x > velocityThreshold {
                AppLogger.calendar.debug("SwipeableScrollView: horizontal pan -> right (previous day)")
                onSwipe(.right)
            }
        }

        @objc func handleRefresh(_ control: UIRefreshControl) {
            AppLogger.calendar.debug("SwipeableScrollView: pull-to-refresh triggered")
            onRefresh?()
        }
    }
}
#endif
