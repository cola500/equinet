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
            Color.equinetGreen
                .ignoresSafeArea()

            VStack(spacing: 16) {
                Image(systemName: "figure.equestrian.sports")
                    .font(.system(size: 64))
                    .foregroundStyle(.white)

                Text("Equinet")
                    .font(.largeTitle)
                    .bold()
                    .foregroundStyle(.white)
            }
        }
    }
}

#Preview {
    SplashView()
}
