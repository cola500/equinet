//
//  SplashView.swift
//  Equinet
//
//  Branded splash screen shown while the WebView loads.
//  Displays the Equinet logo with a brand-colored background.
//

import SwiftUI

struct SplashView: View {
    var body: some View {
        ZStack {
            // Brand background color (matches Equinet green)
            Color(red: 0.16, green: 0.65, blue: 0.47)
                .ignoresSafeArea()

            VStack(spacing: 16) {
                Image(systemName: "figure.equestrian.sports")
                    .font(.system(size: 64))
                    .foregroundStyle(.white)

                Text("Equinet")
                    .font(.largeTitle)
                    .fontWeight(.bold)
                    .foregroundStyle(.white)
            }
        }
    }
}

#Preview {
    SplashView()
}
