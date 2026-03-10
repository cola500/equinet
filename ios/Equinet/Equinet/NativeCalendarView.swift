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
                // UIPageViewController handles horizontal swipe + vertical scroll disambiguation natively
                PagedDayView(
                    selectedDate: $viewModel.selectedDate,
                    onNavigateDay: { viewModel.navigateToDay($0) },
                    onRefresh: { viewModel.refresh() }
                ) { date in
                    ZStack(alignment: .topLeading) {
                        availabilityOverlay(for: date)
                        timeGrid
                        bookingBlocks(for: date)
                        if calendar.isDateInToday(date) { nowLine }
                    }
                    .frame(height: CGFloat(hours.count) * hourHeight)
                }
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
                    viewModel.goToToday()
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

// MARK: - PagedDayView (UIPageViewController for horizontal day swipe + vertical scroll)

/// Uses UIPageViewController for gesture-disambiguation between horizontal day swipe
/// and vertical scroll. This is the same pattern Apple Calendar uses.
/// UIKit's view controller containment handles touch routing automatically.
private struct PagedDayView<Content: View>: UIViewControllerRepresentable {
    @Binding var selectedDate: Date
    var onNavigateDay: (Date) -> Void
    var onRefresh: (() -> Void)?
    @ViewBuilder var content: (Date) -> Content

    func makeCoordinator() -> Coordinator {
        Coordinator(parent: self)
    }

    func makeUIViewController(context: Context) -> UIPageViewController {
        let pageVC = UIPageViewController(
            transitionStyle: .scroll,
            navigationOrientation: .horizontal,
            options: [.interPageSpacing: 0]
        )
        pageVC.dataSource = context.coordinator
        pageVC.delegate = context.coordinator

        let initialPage = context.coordinator.makeDayPage(for: selectedDate)
        pageVC.setViewControllers([initialPage], direction: .forward, animated: false)
        context.coordinator.currentDate = selectedDate

        AppLogger.calendar.debug("PagedDayView: created with UIPageViewController")
        return pageVC
    }

    func updateUIViewController(_ pageVC: UIPageViewController, context: Context) {
        let coord = context.coordinator
        coord.parent = self

        // Programmatic navigation (chevrons, "Idag" button)
        if !Calendar.current.isDate(selectedDate, inSameDayAs: coord.currentDate) {
            let direction: UIPageViewController.NavigationDirection =
                selectedDate > coord.currentDate ? .forward : .reverse
            let newPage = coord.makeDayPage(for: selectedDate)
            coord.currentDate = selectedDate
            pageVC.setViewControllers([newPage], direction: direction, animated: true)
        }
    }

    // MARK: - DayPageViewController

    class DayPageViewController: UIViewController {
        let date: Date
        private let onRefresh: (() -> Void)?
        private var hostController: UIHostingController<Content>?
        private let scrollView = UIScrollView()

        init(date: Date, content: Content, onRefresh: (() -> Void)?) {
            self.date = date
            self.onRefresh = onRefresh
            super.init(nibName: nil, bundle: nil)

            let host = UIHostingController(rootView: content)
            host.view.backgroundColor = .clear
            self.hostController = host
        }

        @available(*, unavailable)
        required init?(coder: NSCoder) { fatalError() }

        override func viewDidLoad() {
            super.viewDidLoad()
            view.backgroundColor = .systemBackground

            scrollView.alwaysBounceVertical = true
            scrollView.showsVerticalScrollIndicator = true
            scrollView.translatesAutoresizingMaskIntoConstraints = false
            view.addSubview(scrollView)

            NSLayoutConstraint.activate([
                scrollView.topAnchor.constraint(equalTo: view.topAnchor),
                scrollView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
                scrollView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
                scrollView.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            ])

            if onRefresh != nil {
                let rc = UIRefreshControl()
                rc.addTarget(self, action: #selector(handleRefresh), for: .valueChanged)
                scrollView.refreshControl = rc
            }

            if let hostView = hostController?.view {
                hostView.backgroundColor = .clear
                hostView.translatesAutoresizingMaskIntoConstraints = false
                addChild(hostController!)
                scrollView.addSubview(hostView)

                NSLayoutConstraint.activate([
                    hostView.topAnchor.constraint(equalTo: scrollView.contentLayoutGuide.topAnchor),
                    hostView.leadingAnchor.constraint(equalTo: scrollView.frameLayoutGuide.leadingAnchor),
                    hostView.trailingAnchor.constraint(equalTo: scrollView.frameLayoutGuide.trailingAnchor),
                    hostView.bottomAnchor.constraint(equalTo: scrollView.contentLayoutGuide.bottomAnchor),
                ])

                hostController?.didMove(toParent: self)
            }
        }

        func updateContent(_ newContent: Content) {
            hostController?.rootView = newContent
        }

        @objc private func handleRefresh(_ control: UIRefreshControl) {
            AppLogger.calendar.debug("PagedDayView: pull-to-refresh triggered")
            onRefresh?()
            // End refreshing after a short delay (parent will update content)
            DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) {
                control.endRefreshing()
            }
        }
    }

    // MARK: - Coordinator

    class Coordinator: NSObject, UIPageViewControllerDataSource, UIPageViewControllerDelegate {
        var parent: PagedDayView
        var currentDate: Date

        init(parent: PagedDayView) {
            self.parent = parent
            self.currentDate = parent.selectedDate
        }

        func makeDayPage(for date: Date) -> DayPageViewController {
            let dayContent = parent.content(date)
            return DayPageViewController(date: date, content: dayContent, onRefresh: parent.onRefresh)
        }

        // MARK: UIPageViewControllerDataSource

        func pageViewController(
            _ pageViewController: UIPageViewController,
            viewControllerBefore viewController: UIViewController
        ) -> UIViewController? {
            guard let dayVC = viewController as? DayPageViewController,
                  let prevDate = Calendar.current.date(byAdding: .day, value: -1, to: dayVC.date)
            else { return nil }
            return makeDayPage(for: prevDate)
        }

        func pageViewController(
            _ pageViewController: UIPageViewController,
            viewControllerAfter viewController: UIViewController
        ) -> UIViewController? {
            guard let dayVC = viewController as? DayPageViewController,
                  let nextDate = Calendar.current.date(byAdding: .day, value: 1, to: dayVC.date)
            else { return nil }
            return makeDayPage(for: nextDate)
        }

        // MARK: UIPageViewControllerDelegate

        func pageViewController(
            _ pageViewController: UIPageViewController,
            didFinishAnimating finished: Bool,
            previousViewControllers: [UIViewController],
            transitionCompleted completed: Bool
        ) {
            guard completed,
                  let dayVC = pageViewController.viewControllers?.first as? DayPageViewController
            else { return }

            currentDate = dayVC.date
            parent.onNavigateDay(dayVC.date)
            UIImpactFeedbackGenerator(style: .light).impactOccurred()
            AppLogger.calendar.debug("PagedDayView: swiped to \(dayVC.date, privacy: .public)")
        }
    }
}
#endif
