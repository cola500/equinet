//
//  QuickNoteSheet.swift
//  Equinet
//
//  Sheet for adding/editing provider notes on a booking.
//  Supports text input and native speech-to-text via SpeechRecognizer.
//

#if os(iOS)
import SwiftUI
import OSLog

struct QuickNoteSheet: View {
    let existingNotes: String?
    let onSave: (String) async -> Bool

    @State private var text: String
    @State private var isRecording = false
    @State private var isSaving = false
    @State private var speechRecognizer: SpeechRecognizer?
    @State private var textBeforeRecording = ""
    @Environment(\.dismiss) private var dismiss

    private let maxLength = 2000

    init(existingNotes: String?, onSave: @escaping (String) async -> Bool) {
        self.existingNotes = existingNotes
        self.onSave = onSave
        self._text = State(initialValue: existingNotes ?? "")
    }

    var body: some View {
        NavigationStack {
            VStack(alignment: .leading, spacing: 16) {
                // Text editor with mic button
                HStack(alignment: .bottom, spacing: 8) {
                    TextEditor(text: $text)
                        .frame(minHeight: 120)
                        .overlay(
                            RoundedRectangle(cornerRadius: 8)
                                .stroke(Color(.systemGray4), lineWidth: 1)
                        )
                        .onChange(of: text) { _, newValue in
                            if newValue.count > maxLength {
                                text = String(newValue.prefix(maxLength))
                            }
                        }

                    Button {
                        toggleRecording()
                    } label: {
                        Image(systemName: isRecording ? "mic.fill" : "mic")
                            .font(.title2)
                            .foregroundStyle(isRecording ? .red : Color.equinetGreen)
                            .frame(width: 44, height: 44)
                    }
                    .accessibilityLabel(isRecording ? "Stoppa inspelning" : "Starta rostinspelning")
                }

                // Status & character count
                HStack {
                    if isRecording {
                        HStack(spacing: 4) {
                            Circle()
                                .fill(.red)
                                .frame(width: 8, height: 8)
                            Text("Lyssnar...")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                    }
                    Spacer()
                    Text("\(text.count)/\(maxLength)")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }

                Spacer()
            }
            .padding()
            .navigationTitle("Snabbnotering")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Avbryt") {
                        stopRecording()
                        dismiss()
                    }
                    .disabled(isSaving)
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Spara") {
                        Task {
                            stopRecording()
                            isSaving = true
                            let success = await onSave(text)
                            isSaving = false
                            if success {
                                dismiss()
                            }
                        }
                    }
                    .disabled(text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || isSaving)
                }
            }
        }
    }

    // MARK: - Speech Recognition

    private func toggleRecording() {
        if isRecording {
            stopRecording()
        } else {
            startRecording()
        }
    }

    private func startRecording() {
        textBeforeRecording = text
        let recognizer = SpeechRecognizer()

        recognizer.onStarted = { [self] in
            isRecording = true
        }

        recognizer.onTranscript = { [self] transcript, _, _ in
            // Partial results replace each other, so rebuild from base text
            if textBeforeRecording.isEmpty {
                text = transcript
            } else {
                text = textBeforeRecording + " " + transcript
            }
        }

        recognizer.onEnded = { [self] _ in
            isRecording = false
        }

        recognizer.onError = { [self] _ in
            isRecording = false
        }

        self.speechRecognizer = recognizer
        recognizer.start()
    }

    private func stopRecording() {
        speechRecognizer?.stop()
        speechRecognizer = nil
        isRecording = false
    }
}
#endif
