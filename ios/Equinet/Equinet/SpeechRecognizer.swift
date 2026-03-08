//
//  SpeechRecognizer.swift
//  Equinet
//
//  Wraps SFSpeechRecognizer + AVAudioEngine for streaming speech-to-text.
//  Communicates results back via callback closures.
//

import Foundation
import Speech
import AVFoundation

@MainActor
final class SpeechRecognizer {

    enum RecognitionError: String {
        case notAvailable = "not_available"
        case permissionDenied = "permission_denied"
        case audioEngineError = "audio_engine_error"
        case recognitionFailed = "recognition_failed"
    }

    // Callbacks -- set by BridgeHandler
    var onStarted: (() -> Void)?
    var onTranscript: ((_ text: String, _ isFinal: Bool) -> Void)?
    var onEnded: ((_ reason: String) -> Void)?
    var onError: ((_ error: RecognitionError) -> Void)?

    private var recognizer: SFSpeechRecognizer?
    private var recognitionRequest: SFSpeechAudioBufferRecognitionRequest?
    private var recognitionTask: SFSpeechRecognitionTask?
    private let audioEngine = AVAudioEngine()
    private var silenceTimer: Timer?
    private let silenceTimeout: TimeInterval = 30.0

    init() {
        recognizer = SFSpeechRecognizer(locale: Locale(identifier: "sv-SE"))
    }

    // MARK: - Public API

    func start() {
        SFSpeechRecognizer.requestAuthorization { [weak self] status in
            Task { @MainActor in
                switch status {
                case .authorized:
                    self?.requestMicrophoneAndStart()
                case .denied, .restricted:
                    self?.onError?(.permissionDenied)
                case .notDetermined:
                    self?.onError?(.permissionDenied)
                @unknown default:
                    self?.onError?(.permissionDenied)
                }
            }
        }
    }

    func stop() {
        silenceTimer?.invalidate()
        silenceTimer = nil
        recognitionRequest?.endAudio()
        audioEngine.stop()
        audioEngine.inputNode.removeTap(onBus: 0)
        recognitionTask?.cancel()
        recognitionTask = nil
        recognitionRequest = nil
    }

    // MARK: - Private

    private func requestMicrophoneAndStart() {
        AVAudioApplication.requestRecordPermission { [weak self] granted in
            Task { @MainActor in
                if granted {
                    self?.startRecognition()
                } else {
                    self?.onError?(.permissionDenied)
                }
            }
        }
    }

    private func startRecognition() {
        guard let recognizer, recognizer.isAvailable else {
            onError?(.notAvailable)
            return
        }

        // Clean up any previous session
        stop()

        let request = SFSpeechAudioBufferRecognitionRequest()
        request.shouldReportPartialResults = true

        // Prefer on-device recognition (offline support)
        if recognizer.supportsOnDeviceRecognition {
            request.requiresOnDeviceRecognition = true
        }

        self.recognitionRequest = request

        do {
            let audioSession = AVAudioSession.sharedInstance()
            try audioSession.setCategory(.record, mode: .measurement, options: .duckOthers)
            try audioSession.setActive(true, options: .notifyOthersOnDeactivation)
        } catch {
            onError?(.audioEngineError)
            return
        }

        let inputNode = audioEngine.inputNode
        let recordingFormat = inputNode.outputFormat(forBus: 0)
        inputNode.installTap(onBus: 0, bufferSize: 1024, format: recordingFormat) { buffer, _ in
            request.append(buffer)
        }

        do {
            try audioEngine.start()
        } catch {
            onError?(.audioEngineError)
            return
        }

        onStarted?()
        resetSilenceTimer()

        recognitionTask = recognizer.recognitionTask(with: request) { [weak self] result, error in
            Task { @MainActor in
                guard let self else { return }

                if let result {
                    let text = result.bestTranscription.formattedString
                    let isFinal = result.isFinal
                    self.onTranscript?(text, isFinal)
                    self.resetSilenceTimer()

                    if isFinal {
                        self.stop()
                        self.onEnded?("final")
                    }
                }

                if let error {
                    let nsError = error as NSError
                    // Error code 1 = "no speech detected" -- not a real error
                    if nsError.domain == "kAFAssistantErrorDomain" && nsError.code == 1 {
                        self.stop()
                        self.onEnded?("silence")
                        return
                    }
                    print("[SpeechRecognizer] Error: \(error.localizedDescription)")
                    self.stop()
                    self.onError?(.recognitionFailed)
                }
            }
        }
    }

    private func resetSilenceTimer() {
        silenceTimer?.invalidate()
        silenceTimer = Timer.scheduledTimer(withTimeInterval: silenceTimeout, repeats: false) { [weak self] _ in
            Task { @MainActor in
                self?.stop()
                self?.onEnded?("timeout")
            }
        }
    }
}
