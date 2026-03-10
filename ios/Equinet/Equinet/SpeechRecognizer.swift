//
//  SpeechRecognizer.swift
//  Equinet
//
//  Wraps SFSpeechRecognizer + AVAudioEngine for streaming speech-to-text.
//  Communicates results back via callback closures.
//

import Foundation
import OSLog
import Speech
import AVFoundation

// MARK: - Audio Session Protocol for DI

@MainActor
protocol AudioSessionConfigurable {
    func setCategory(_ category: AVAudioSession.Category, mode: AVAudioSession.Mode, options: AVAudioSession.CategoryOptions) throws
    func setActive(_ active: Bool, options: AVAudioSession.SetActiveOptions) throws
}

extension AVAudioSession: AudioSessionConfigurable {}

// MARK: - Protocol for DI

@MainActor
protocol SpeechRecognizable: AnyObject {
    var onStarted: (() -> Void)? { get set }
    var onTranscript: ((_ text: String, _ isFinal: Bool, _ confidence: Float?) -> Void)? { get set }
    var onAudioLevel: ((_ level: Float) -> Void)? { get set }
    var onEnded: ((_ reason: String) -> Void)? { get set }
    var onError: ((_ error: SpeechRecognizer.RecognitionError) -> Void)? { get set }

    func start()
    func stop()
}

// MARK: - Implementation

@MainActor
final class SpeechRecognizer: SpeechRecognizable {

    enum RecognitionError: String {
        case notAvailable = "not_available"
        case permissionDenied = "permission_denied"
        case audioEngineError = "audio_engine_error"
        case recognitionFailed = "recognition_failed"
    }

    // Callbacks -- set by BridgeHandler
    var onStarted: (() -> Void)?
    var onTranscript: ((_ text: String, _ isFinal: Bool, _ confidence: Float?) -> Void)?
    var onAudioLevel: ((_ level: Float) -> Void)?
    var onEnded: ((_ reason: String) -> Void)?
    var onError: ((_ error: RecognitionError) -> Void)?

    private var recognizer: SFSpeechRecognizer?
    private var recognitionRequest: SFSpeechAudioBufferRecognitionRequest?
    private var recognitionTask: SFSpeechRecognitionTask?
    private let audioEngine = AVAudioEngine()
    private var silenceTimer: Timer?
    private let silenceTimeout: TimeInterval = 30.0
    private var lastAudioLevelTime: TimeInterval = 0
    private let audioSession: AudioSessionConfigurable

    init(audioSession: AudioSessionConfigurable? = nil) {
        self.audioSession = audioSession ?? AVAudioSession.sharedInstance()
        recognizer = SFSpeechRecognizer(locale: Locale(identifier: "sv-SE"))
    }

    // MARK: - Public API

    func start() {
        SFSpeechRecognizer.requestAuthorization { status in
            Task { @MainActor [weak self] in
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
        lastAudioLevelTime = 0
    }

    // MARK: - Private

    private func requestMicrophoneAndStart() {
        AVAudioApplication.requestRecordPermission { granted in
            Task { @MainActor [weak self] in
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

            // Calculate RMS audio level from buffer
            guard let channelData = buffer.floatChannelData?[0] else { return }
            let frameLength = Int(buffer.frameLength)
            guard frameLength > 0 else { return }

            var sum: Float = 0
            for i in 0..<frameLength {
                sum += channelData[i] * channelData[i]
            }
            let rms = sqrt(sum / Float(frameLength))
            // Normalize to 0-1 range (typical speech RMS is 0.01-0.3)
            let normalized = min(1.0, rms * 5.0)

            Task { @MainActor [weak self] in
                // Throttle to ~10 Hz on main actor
                let now = CACurrentMediaTime()
                guard let self, now - self.lastAudioLevelTime >= 0.1 else { return }
                self.lastAudioLevelTime = now
                self.onAudioLevel?(normalized)
            }
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
                    let confidence = result.bestTranscription.segments.last?.confidence
                    self.onTranscript?(text, isFinal, confidence)
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
                    AppLogger.speech.error("Recognition error: \(error.localizedDescription)")
                    self.stop()
                    self.onError?(.recognitionFailed)
                }
            }
        }
    }

    private func resetSilenceTimer() {
        silenceTimer?.invalidate()
        silenceTimer = Timer.scheduledTimer(withTimeInterval: silenceTimeout, repeats: false) { _ in
            Task { @MainActor [weak self] in
                self?.stop()
                self?.onEnded?("timeout")
            }
        }
    }
}
