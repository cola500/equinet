//
//  NetworkMonitor.swift
//  Equinet
//
//  Monitors network connectivity using NWPathMonitor.
//  Publishes changes so SwiftUI views and the bridge can react.
//

import Foundation
import Network
import Observation

@MainActor
@Observable
final class NetworkMonitor: NetworkStatusProviding {

    private let monitor = NWPathMonitor()
    private let queue = DispatchQueue(label: "com.equinet.networkmonitor")

    /// Real network state from NWPathMonitor
    private var realIsConnected = true
    var connectionType: ConnectionType = .unknown

    #if DEBUG
    /// Debug override for automated testing (mobile-mcp / simctl).
    /// When set, overrides NWPathMonitor state.
    var debugOverrideConnected: Bool? {
        didSet {
            let oldConnected = oldValue ?? realIsConnected
            let newConnected = isConnected
            if oldConnected != newConnected {
                onStatusChanged?(newConnected)
            }
        }
    }
    #endif

    var isConnected: Bool {
        #if DEBUG
        if let override = debugOverrideConnected {
            return override
        }
        #endif
        return realIsConnected
    }

    enum ConnectionType {
        case wifi
        case cellular
        case wired
        case unknown
    }

    func start() {
        #if DEBUG
        setupDebugNotificationListener()
        #endif

        monitor.pathUpdateHandler = { [weak self] path in
            let status = path.status
            let usesWifi = path.usesInterfaceType(.wifi)
            let usesCellular = path.usesInterfaceType(.cellular)
            let usesWired = path.usesInterfaceType(.wiredEthernet)

            Task { @MainActor [weak self] in
                guard let self else { return }

                let wasConnected = self.isConnected
                self.realIsConnected = status == .satisfied

                if usesWifi { self.connectionType = .wifi }
                else if usesCellular { self.connectionType = .cellular }
                else if usesWired { self.connectionType = .wired }
                else { self.connectionType = .unknown }

                // Only notify bridge on actual changes
                if wasConnected != self.isConnected {
                    self.onStatusChanged?(self.isConnected)
                }
            }
        }
        monitor.start(queue: queue)
    }

    func stop() {
        monitor.cancel()
        #if DEBUG
        debugPollTimer?.invalidate()
        debugPollTimer = nil
        #endif
    }

    /// Callback for bridge integration -- set by ContentView
    var onStatusChanged: ((Bool) -> Void)?

    private func getConnectionType(_ path: NWPath) -> ConnectionType {
        if path.usesInterfaceType(.wifi) { return .wifi }
        if path.usesInterfaceType(.cellular) { return .cellular }
        if path.usesInterfaceType(.wiredEthernet) { return .wired }
        return .unknown
    }

    #if DEBUG
    private var debugPollTimer: Timer?

    /// Polls UserDefaults for external debug triggers.
    /// Set offline: xcrun simctl spawn <UDID> defaults write com.equinet.Equinet debugOffline -bool true
    /// Clear:       xcrun simctl spawn <UDID> defaults delete com.equinet.Equinet debugOffline
    private func setupDebugNotificationListener() {
        debugPollTimer = Timer.scheduledTimer(withTimeInterval: 1.0, repeats: true) { [weak self] _ in
            Task { @MainActor [weak self] in
                guard let self else { return }
                let defaults = UserDefaults.standard
                if defaults.object(forKey: "debugOffline") != nil {
                    let offline = defaults.bool(forKey: "debugOffline")
                    let newValue: Bool? = offline ? false : nil
                    if self.debugOverrideConnected != newValue {
                        self.debugOverrideConnected = newValue
                    }
                } else if self.debugOverrideConnected != nil {
                    self.debugOverrideConnected = nil
                }
            }
        }
    }
    #endif
}
