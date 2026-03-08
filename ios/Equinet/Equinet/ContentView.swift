//
//  ContentView.swift
//  Equinet
//
//  Main content view that wraps the WebView with navigation controls.
//

import SwiftUI

struct ContentView: View {
    @State private var canGoBack = false
    @State private var isLoading = false
    @State private var bridge = BridgeHandler()

    var body: some View {
        #if os(iOS)
        ZStack {
            WebView(
                url: AppConfig.baseURL,
                bridge: bridge,
                canGoBack: $canGoBack,
                isLoading: $isLoading
            )
            .ignoresSafeArea(edges: .bottom)

            // Loading indicator
            if isLoading {
                VStack {
                    ProgressView()
                        .progressViewStyle(.circular)
                        .tint(.accentColor)
                    Spacer()
                }
                .padding(.top, 4)
            }
        }
        #else
        Text("Equinet is available on iOS")
            .padding()
        #endif
    }
}

#Preview {
    ContentView()
}
