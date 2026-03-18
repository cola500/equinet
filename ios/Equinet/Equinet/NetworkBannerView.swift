//
//  NetworkBannerView.swift
//  Equinet
//
//  Shared offline/reconnected banners used by AuthenticatedView
//  and CustomerWebView.
//

#if os(iOS)
import SwiftUI

struct NetworkBannerView {
    struct Offline: View {
        var body: some View {
            Label("Ingen internetanslutning", systemImage: "wifi.slash")
                .font(.caption)
                .fontWeight(.medium)
                .foregroundStyle(.white)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 6)
                .background(Color.orange)
                .accessibilityElement(children: .combine)
                .accessibilityLabel("Ingen internetanslutning")
        }
    }

    struct Reconnected: View {
        var body: some View {
            Label("Ansluten igen", systemImage: "wifi")
                .font(.caption)
                .fontWeight(.medium)
                .foregroundStyle(.white)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 6)
                .background(Color.green)
                .transition(.move(edge: .top).combined(with: .opacity))
                .accessibilityElement(children: .combine)
                .accessibilityLabel("Ansluten igen")
        }
    }
}
#endif
