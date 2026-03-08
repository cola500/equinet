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
final class NetworkMonitor {

    private let monitor = NWPathMonitor()
    private let queue = DispatchQueue(label: "com.equinet.networkmonitor")

    var isConnected = true
    var connectionType: ConnectionType = .unknown

    enum ConnectionType {
        case wifi
        case cellular
        case wired
        case unknown
    }

    func start() {
        monitor.pathUpdateHandler = { [weak self] path in
            let status = path.status
            let usesWifi = path.usesInterfaceType(.wifi)
            let usesCellular = path.usesInterfaceType(.cellular)
            let usesWired = path.usesInterfaceType(.wiredEthernet)

            Task { @MainActor [weak self] in
                guard let self else { return }

                let wasConnected = self.isConnected
                self.isConnected = status == .satisfied

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
    }

    /// Callback for bridge integration -- set by ContentView
    var onStatusChanged: ((Bool) -> Void)?

    private func getConnectionType(_ path: NWPath) -> ConnectionType {
        if path.usesInterfaceType(.wifi) { return .wifi }
        if path.usesInterfaceType(.cellular) { return .cellular }
        if path.usesInterfaceType(.wiredEthernet) { return .wired }
        return .unknown
    }
}
