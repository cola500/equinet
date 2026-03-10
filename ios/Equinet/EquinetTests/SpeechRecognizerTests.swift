//
//  SpeechRecognizerTests.swift
//  EquinetTests
//
//  Tests for SpeechRecognizer with AudioSession dependency injection.
//

@testable import Equinet
import AVFoundation
import XCTest

// MARK: - Mock Audio Session

@MainActor
final class MockAudioSession: AudioSessionConfigurable {
    var setCategoryCalled = false
    var setActiveCalled = false
    var shouldFailSetCategory = false
    var shouldFailSetActive = false
    var lastCategory: AVAudioSession.Category?
    var lastMode: AVAudioSession.Mode?

    func setCategory(_ category: AVAudioSession.Category, mode: AVAudioSession.Mode, options: AVAudioSession.CategoryOptions) throws {
        setCategoryCalled = true
        lastCategory = category
        lastMode = mode
        if shouldFailSetCategory {
            throw NSError(domain: "TestError", code: 1, userInfo: [NSLocalizedDescriptionKey: "Mock audio session error"])
        }
    }

    func setActive(_ active: Bool, options: AVAudioSession.SetActiveOptions) throws {
        setActiveCalled = true
        if shouldFailSetActive {
            throw NSError(domain: "TestError", code: 2, userInfo: [NSLocalizedDescriptionKey: "Mock set active error"])
        }
    }
}

// MARK: - Tests

@MainActor
final class SpeechRecognizerTests: XCTestCase {

    private var mockAudioSession: MockAudioSession!
    private var sut: SpeechRecognizer!

    override func setUp() {
        super.setUp()
        mockAudioSession = MockAudioSession()
        sut = SpeechRecognizer(audioSession: mockAudioSession)
    }

    override func tearDown() {
        sut = nil
        mockAudioSession = nil
        super.tearDown()
    }

    // MARK: - RecognitionError

    func testRecognitionErrorNotAvailableRawValue() {
        XCTAssertEqual(SpeechRecognizer.RecognitionError.notAvailable.rawValue, "not_available")
    }

    func testRecognitionErrorPermissionDeniedRawValue() {
        XCTAssertEqual(SpeechRecognizer.RecognitionError.permissionDenied.rawValue, "permission_denied")
    }

    func testRecognitionErrorAudioEngineErrorRawValue() {
        XCTAssertEqual(SpeechRecognizer.RecognitionError.audioEngineError.rawValue, "audio_engine_error")
    }

    func testRecognitionErrorRecognitionFailedRawValue() {
        XCTAssertEqual(SpeechRecognizer.RecognitionError.recognitionFailed.rawValue, "recognition_failed")
    }

    // MARK: - Initial State

    func testInitialCallbacksAreNil() {
        XCTAssertNil(sut.onStarted)
        XCTAssertNil(sut.onTranscript)
        XCTAssertNil(sut.onAudioLevel)
        XCTAssertNil(sut.onEnded)
        XCTAssertNil(sut.onError)
    }

    func testConformsToSpeechRecognizableProtocol() {
        let recognizable: SpeechRecognizable = sut
        XCTAssertNotNil(recognizable)
    }

    // MARK: - Callbacks

    func testSettingOnStartedCallback() {
        var called = false
        sut.onStarted = { called = true }
        sut.onStarted?()
        XCTAssertTrue(called)
    }

    func testSettingOnTranscriptCallback() {
        var receivedText: String?
        var receivedFinal: Bool?
        var receivedConfidence: Float?
        sut.onTranscript = { text, isFinal, confidence in
            receivedText = text
            receivedFinal = isFinal
            receivedConfidence = confidence
        }
        sut.onTranscript?("test", true, 0.95)
        XCTAssertEqual(receivedText, "test")
        XCTAssertEqual(receivedFinal, true)
        XCTAssertEqual(receivedConfidence, 0.95)
    }

    func testSettingOnAudioLevelCallback() {
        var receivedLevel: Float?
        sut.onAudioLevel = { level in
            receivedLevel = level
        }
        sut.onAudioLevel?(0.5)
        XCTAssertEqual(receivedLevel, 0.5)
    }

    func testSettingOnEndedCallback() {
        var receivedReason: String?
        sut.onEnded = { reason in
            receivedReason = reason
        }
        sut.onEnded?("timeout")
        XCTAssertEqual(receivedReason, "timeout")
    }

    func testSettingOnErrorCallback() {
        var receivedError: SpeechRecognizer.RecognitionError?
        sut.onError = { error in
            receivedError = error
        }
        sut.onError?(.permissionDenied)
        XCTAssertEqual(receivedError, .permissionDenied)
    }

    // MARK: - Stop

    func testStopCanBeCalledSafely() {
        // Should not crash when called without start
        sut.stop()
    }

    func testStopCanBeCalledMultipleTimes() {
        sut.stop()
        sut.stop()
        sut.stop()
        // No crash = pass
    }

    // MARK: - Audio Session Injection

    func testDefaultInitCreatesValidInstance() {
        let recognizer = SpeechRecognizer()
        XCTAssertNotNil(recognizer)
    }

    func testCustomAudioSessionIsInjected() {
        // The mock audio session is injected in setUp
        // If startRecognition were called with proper auth, it would use our mock
        XCTAssertNotNil(sut)
        XCTAssertFalse(mockAudioSession.setCategoryCalled)
    }
}
