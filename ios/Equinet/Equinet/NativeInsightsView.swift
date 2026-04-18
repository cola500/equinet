//
//  NativeInsightsView.swift
//  Equinet
//
//  Native SwiftUI view for business insights.
//  Shows KPIs, service breakdown (bar chart), time heatmap (grid),
//  and customer retention (line chart) with period selection.
//  Does NOT own a NavigationStack -- uses NativeMoreView's stack.
//

#if os(iOS)
import SwiftUI
import Charts

struct NativeInsightsView: View {
    @Bindable var viewModel: InsightsViewModel

    var body: some View {
        content
            .navigationTitle("Insikter")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Picker("Period", selection: Binding(
                        get: { viewModel.selectedPeriod },
                        set: { period in
                            Task { await viewModel.changePeriod(to: period) }
                        }
                    )) {
                        ForEach(InsightsPeriod.allCases) { period in
                            Text(period.label).tag(period)
                        }
                    }
                    .pickerStyle(.segmented)
                    .frame(width: 180)
                }
            }
            .sensoryFeedback(.selection, trigger: viewModel.selectedPeriod)
            .task {
                await viewModel.loadInsights()
            }
            .refreshable {
                await viewModel.refresh()
            }
    }

    // MARK: - Content

    @ViewBuilder
    private var content: some View {
        if viewModel.isLoading {
            VStack {
                Spacer()
                ProgressView("Laddar insikter...")
                Spacer()
            }
        } else if let error = viewModel.error {
            ContentUnavailableView {
                Label("Något gick fel", systemImage: "exclamationmark.triangle")
            } description: {
                Text(error)
            } actions: {
                Button("Försök igen") {
                    Task { await viewModel.loadInsights() }
                }
                .buttonStyle(.borderedProminent)
            }
        } else if let response = viewModel.response {
            ScrollView {
                VStack(spacing: 20) {
                    KPICardsView(kpis: response.kpis)
                    ServiceBreakdownChart(services: response.serviceBreakdown)
                    HeatmapGridView(matrix: viewModel.heatmapMatrix)
                    RetentionChart(retention: response.customerRetention)
                }
                .padding()
            }
        } else {
            ContentUnavailableView {
                Label("Inga data", systemImage: "chart.bar.xaxis")
            } description: {
                Text("Ladda om för att hämta insikter.")
            }
        }
    }
}

// MARK: - KPI Cards

private struct KPICardsView: View {
    let kpis: InsightsKPIs

    var body: some View {
        LazyVGrid(columns: [
            GridItem(.flexible()),
            GridItem(.flexible()),
        ], spacing: 12) {
            KPICard(
                title: "Avbokningsgrad",
                value: "\(kpis.cancellationRate)%",
                icon: "xmark.circle",
                warning: kpis.cancellationRate > 20
            )
            KPICard(
                title: "No-show",
                value: "\(kpis.noShowRate)%",
                icon: "person.slash",
                warning: kpis.noShowRate > 10
            )
            KPICard(
                title: "Snittbokningsvärde",
                value: "\(kpis.averageBookingValue) kr",
                icon: "banknote",
                warning: false
            )
            KPICard(
                title: "Unika kunder",
                value: "\(kpis.uniqueCustomers)",
                icon: "person.2",
                warning: false
            )
            KPICard(
                title: "Manuella bokningar",
                value: "\(kpis.manualBookingRate)%",
                icon: "hand.tap",
                warning: false
            )
        }
    }
}

private struct KPICard: View {
    let title: String
    let value: String
    let icon: String
    let warning: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Label(title, systemImage: icon)
                .font(.caption)
                .foregroundStyle(.secondary)
            Text(value)
                .font(.title2)
                .bold()
                .foregroundStyle(warning ? .red : .primary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding()
        .background(.quaternary.opacity(0.5))
        .clipShape(.rect(cornerRadius: 12))
        .accessibilityElement(children: .combine)
    }
}

// MARK: - Service Breakdown Chart

private struct ServiceBreakdownChart: View {
    let services: [ServiceBreakdownItem]

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Populäraste tjänster")
                .font(.headline)

            if services.isEmpty {
                Text("Inga genomförda bokningar i perioden.")
                    .foregroundStyle(.secondary)
                    .font(.subheadline)
            } else {
                Chart(services) { service in
                    BarMark(
                        x: .value("Antal", service.count),
                        y: .value("Tjänst", service.serviceName)
                    )
                    .foregroundStyle(.green.gradient)
                    .annotation(position: .trailing) {
                        Text(service.formattedRevenue)
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                    }
                }
                .chartYAxis {
                    AxisMarks { _ in
                        AxisValueLabel()
                    }
                }
                .frame(height: CGFloat(max(120, services.count * 44)))
            }
        }
        .padding()
        .background(.quaternary.opacity(0.5))
        .clipShape(.rect(cornerRadius: 12))
    }
}

// MARK: - Heatmap Grid

private struct HeatmapGridView: View {
    let matrix: HeatmapMatrix

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Populäraste tider")
                .font(.headline)

            if matrix.hours.isEmpty {
                Text("Inte tillräckligt med data för att visa tidsanalys.")
                    .foregroundStyle(.secondary)
                    .font(.subheadline)
            } else {
                ScrollView(.horizontal, showsIndicators: false) {
                    VStack(alignment: .leading, spacing: 2) {
                        // Hour labels
                        HStack(spacing: 2) {
                            Text("")
                                .frame(width: 32)
                            ForEach(matrix.hours, id: \.self) { hour in
                                Text("\(hour)")
                                    .font(.caption2)
                                    .frame(width: 28)
                            }
                        }

                        // Day rows
                        ForEach(0..<matrix.days.count, id: \.self) { dayIdx in
                            HStack(spacing: 2) {
                                Text(matrix.days[dayIdx])
                                    .font(.caption)
                                    .frame(width: 32, alignment: .leading)

                                ForEach(0..<matrix.hours.count, id: \.self) { hourIdx in
                                    let count = matrix.cells[dayIdx][hourIdx]
                                    let intensity = matrix.intensity(day: dayIdx, hour: hourIdx)
                                    HeatmapCell(count: count, intensity: intensity)
                                }
                            }
                        }
                    }
                }
                .scrollIndicators(.hidden)
            }
        }
        .padding()
        .background(.quaternary.opacity(0.5))
        .clipShape(.rect(cornerRadius: 12))
    }
}

private struct HeatmapCell: View {
    let count: Int
    let intensity: Double

    private var color: Color {
        if count == 0 {
            .gray.opacity(0.15)
        } else if intensity < 0.25 {
            .green.opacity(0.25)
        } else if intensity < 0.5 {
            .green.opacity(0.5)
        } else if intensity < 0.75 {
            .green.opacity(0.7)
        } else {
            .green
        }
    }

    var body: some View {
        RoundedRectangle(cornerRadius: 3)
            .fill(color)
            .frame(width: 28, height: 28)
            .overlay {
                if count > 0 {
                    Text("\(count)")
                        .font(.caption2)
                        .foregroundStyle(intensity >= 0.5 ? .white : .primary)
                }
            }
            .accessibilityLabel("\(count) bokningar")
    }
}

// MARK: - Customer Retention Chart

private struct RetentionChart: View {
    let retention: [CustomerRetentionMonth]

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Kundretention")
                .font(.headline)

            if retention.isEmpty {
                Text("Inte tillräckligt med data för att visa kundretention.")
                    .foregroundStyle(.secondary)
                    .font(.subheadline)
            } else {
                Chart {
                    ForEach(retention) { month in
                        LineMark(
                            x: .value("Månad", month.month),
                            y: .value("Antal", month.newCustomers),
                            series: .value("Typ", "Nya kunder")
                        )
                        .foregroundStyle(.blue)

                        LineMark(
                            x: .value("Månad", month.month),
                            y: .value("Antal", month.returningCustomers),
                            series: .value("Typ", "Återkommande")
                        )
                        .foregroundStyle(.green)
                    }
                }
                .chartForegroundStyleScale([
                    "Nya kunder": .blue,
                    "Återkommande": .green,
                ])
                .frame(height: 200)
            }
        }
        .padding()
        .background(.quaternary.opacity(0.5))
        .clipShape(.rect(cornerRadius: 12))
    }
}

#endif
