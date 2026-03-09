//
//  BridgeHandlerTests.swift
//  EquinetTests
//
//  Tests for BridgeHandler message routing and speech recognition integration.
//

@testable import Equinet
import WebKit
import XCTest

// MARK: - Mock Speech Recognizer

@MainActor
final class MockSpeechRecognizer: SpeechRecognizable {
    var onStarted: (() -> Void)?
    var onTranscript: ((_ text: String, _ isFinal: Bool, _ confidence: Float?) -> Void)?
    var onAudioLevel: ((_ level: Float) -> Void)?
    var onEnded: ((_ reason: String) -> Void)?
    var onError: ((_ error: SpeechRecognizer.RecognitionError) -> Void)?

    var startCallCount = 0
    var stopCallCount = 0

    func start() {
        startCallCount += 1
    }

    func stop() {
        stopCallCount += 1
    }
}

// MARK: - Tests

@MainActor
final class BridgeHandlerTests: XCTestCase {

    private var mockSpeech: MockSpeechRecognizer!
    private var sut: BridgeHandler!

    override func setUp() {
        super.setUp()
        mockSpeech = MockSpeechRecognizer()
        sut = BridgeHandler(speechRecognizer: mockSpeech)
    }

    override func tearDown() {
        sut = nil
        mockSpeech = nil
        super.tearDown()
    }

    // MARK: - Message Routing

    func testHandleMessageStartSpeech() {
        let message = FakeScriptMessage(body: [
            "type": "startSpeechRecognition",
        ])
        sut.handleMessage(message)
        XCTAssertEqual(mockSpeech.startCallCount, 1)
    }

    func testHandleMessageStopSpeech() {
        let message = FakeScriptMessage(body: [
            "type": "stopSpeechRecognition",
        ])
        sut.handleMessage(message)
        XCTAssertEqual(mockSpeech.stopCallCount, 1)
    }

    func testHandleMessageInvalidFormat() {
        // String instead of dict -- should not crash
        let message = FakeScriptMessage(body: "not a dict")
        sut.handleMessage(message)
        // No crash = pass
    }

    func testHandleMessageMissingType() {
        let message = FakeScriptMessage(body: ["payload": ["key": "value"]])
        sut.handleMessage(message)
        // No crash = pass
    }

    func testHandleMessageUnknownType() {
        let message = FakeScriptMessage(body: ["type": "unknownType123"])
        sut.handleMessage(message)
        // No crash = pass, unknown type logged
    }

    // MARK: - Speech Callbacks Wired

    func testSpeechCallbacksWiredAfterAttach() {
        // attach() calls setupSpeechCallbacks()
        // We can't test sendToWeb without a real WKWebView,
        // but we can verify the callbacks are set on the mock
        sut.attach(to: FakeWebView())

        XCTAssertNotNil(mockSpeech.onStarted)
        XCTAssertNotNil(mockSpeech.onTranscript)
        XCTAssertNotNil(mockSpeech.onAudioLevel)
        XCTAssertNotNil(mockSpeech.onEnded)
        XCTAssertNotNil(mockSpeech.onError)
    }

    // MARK: - Constructor Injection

    func testDefaultInitUsesRealSpeechRecognizer() {
        // Verify that default init compiles and creates a valid instance
        let handler = BridgeHandler()
        XCTAssertNotNil(handler)
    }

    func testCustomSpeechRecognizerInjected() {
        // Start speech via message -- should hit the mock, not a real recognizer
        let message = FakeScriptMessage(body: ["type": "startSpeechRecognition"])
        sut.handleMessage(message)
        XCTAssertEqual(mockSpeech.startCallCount, 1)

        let stopMessage = FakeScriptMessage(body: ["type": "stopSpeechRecognition"])
        sut.handleMessage(stopMessage)
        XCTAssertEqual(mockSpeech.stopCallCount, 1)
    }

    // MARK: - sendNetworkStatus (no WebView attached)

    func testSendNetworkStatusWithoutWebView() {
        // Should not crash when no WebView is attached
        sut.sendNetworkStatus(isOnline: true)
        sut.sendNetworkStatus(isOnline: false)
        // No crash = pass
    }
}

// MARK: - Fakes

/// Minimal WKScriptMessage substitute for testing.
/// WKScriptMessage can't be directly instantiated, so we subclass it.
private class FakeScriptMessage: WKScriptMessage {
    private let _body: Any

    init(body: Any) {
        _body = body
        super.init()
    }

    override var body: Any { _body }
}

/// Minimal WKWebView for testing attach().
private class FakeWebView: WKWebView {
    init() {
        super.init(frame: .zero, configuration: WKWebViewConfiguration())
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) {
        fatalError("init(coder:) not used")
    }
}
