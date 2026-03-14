//
//  ExceptionFormSheet.swift
//  Equinet
//
//  Form sheet for creating/editing availability exceptions.
//  Presented as a .sheet from NativeCalendarView context menu.
//

#if os(iOS)
import SwiftUI

struct ExceptionFormSheet: View {
    let date: Date
    let existingException: NativeException?
    let onSave: (ExceptionSaveRequest) -> Void
    let onDelete: (String) -> Void

    @Environment(\.dismiss) private var dismiss

    @State private var isClosed: Bool
    @State private var startTime: Date
    @State private var endTime: Date
    @State private var reason: String
    @State private var location: String

    init(
        date: Date,
        existingException: NativeException?,
        onSave: @escaping (ExceptionSaveRequest) -> Void,
        onDelete: @escaping (String) -> Void
    ) {
        self.date = date
        self.existingException = existingException
        self.onSave = onSave
        self.onDelete = onDelete

        // Pre-populate from existing exception
        _isClosed = State(initialValue: existingException?.isClosed ?? true)
        _reason = State(initialValue: existingException?.reason ?? "")
        _location = State(initialValue: existingException?.location ?? "")

        // Parse times or use defaults
        let defaultStart = Self.timeFromString("09:00")
        let defaultEnd = Self.timeFromString("17:00")
        _startTime = State(initialValue: Self.timeFromString(existingException?.startTime) ?? defaultStart)
        _endTime = State(initialValue: Self.timeFromString(existingException?.endTime) ?? defaultEnd)
    }

    var body: some View {
        NavigationStack {
            Form {
                // Date display
                Section {
                    HStack {
                        Text("Datum")
                        Spacer()
                        Text(Self.dateFormatter.string(from: date))
                            .foregroundStyle(.secondary)
                    }
                }

                // Closed toggle
                Section {
                    Toggle("Stängd hela dagen", isOn: $isClosed)
                }

                // Time pickers (only when not closed)
                if !isClosed {
                    Section("Öppettider") {
                        DatePicker("Från", selection: $startTime, displayedComponents: .hourAndMinute)
                        DatePicker("Till", selection: $endTime, displayedComponents: .hourAndMinute)
                    }
                }

                // Reason & location
                Section {
                    TextField("Anledning (t.ex. Semester, Sjuk)", text: $reason)
                        .textInputAutocapitalization(.sentences)
                    TextField("Arbetsplats (t.ex. Sollebrunn)", text: $location)
                        .textInputAutocapitalization(.words)
                }

                // Delete button (only for existing exceptions)
                if existingException != nil {
                    Section {
                        Button("Ta bort undantag", role: .destructive) {
                            onDelete(Self.isoFormatter.string(from: date))
                            dismiss()
                        }
                    }
                }
            }
            .navigationTitle(existingException != nil ? "Redigera undantag" : "Nytt undantag")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Avbryt") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Spara") {
                        save()
                        dismiss()
                    }
                    .disabled(!isClosed && startTime >= endTime)
                }
            }
        }
        .presentationDetents([.medium])
    }

    // MARK: - Save

    private func save() {
        let dateString = Self.isoFormatter.string(from: date)
        let request = ExceptionSaveRequest(
            date: dateString,
            isClosed: isClosed,
            startTime: isClosed ? nil : Self.timeFormatter.string(from: startTime),
            endTime: isClosed ? nil : Self.timeFormatter.string(from: endTime),
            reason: reason.trimmingCharacters(in: .whitespaces).isEmpty ? nil : reason.trimmingCharacters(in: .whitespaces),
            location: location.trimmingCharacters(in: .whitespaces).isEmpty ? nil : location.trimmingCharacters(in: .whitespaces)
        )
        onSave(request)
    }

    // MARK: - Static Formatters

    private static let dateFormatter: DateFormatter = {
        let f = DateFormatter()
        f.locale = Locale(identifier: "sv_SE")
        f.dateFormat = "d MMMM yyyy"
        return f
    }()

    private static let isoFormatter: DateFormatter = {
        let f = DateFormatter()
        f.dateFormat = "yyyy-MM-dd"
        return f
    }()

    private static let timeFormatter: DateFormatter = {
        let f = DateFormatter()
        f.dateFormat = "HH:mm"
        return f
    }()

    /// Parse "HH:mm" string to a Date (today with that time)
    private static func timeFromString(_ timeString: String?) -> Date? {
        guard let timeString else { return nil }
        let formatter = DateFormatter()
        formatter.dateFormat = "HH:mm"
        return formatter.date(from: timeString)
    }

    /// Parse "HH:mm" to Date, returning a default for nil
    private static func timeFromString(_ timeString: String) -> Date {
        let formatter = DateFormatter()
        formatter.dateFormat = "HH:mm"
        return formatter.date(from: timeString) ?? Date()
    }
}

#endif
