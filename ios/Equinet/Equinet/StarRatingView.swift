import SwiftUI

/// Reusable star rating component -- supports readonly display and interactive selection.
struct StarRatingView: View {
    let rating: Int
    let maxRating: Int
    let font: Font
    var interactive: Bool = false
    var onRatingChanged: ((Int) -> Void)?

    init(rating: Int, maxRating: Int = 5, font: Font = .caption, interactive: Bool = false, onRatingChanged: ((Int) -> Void)? = nil) {
        self.rating = rating
        self.maxRating = maxRating
        self.font = font
        self.interactive = interactive
        self.onRatingChanged = onRatingChanged
    }

    var body: some View {
        HStack(spacing: interactive ? 8 : 2) {
            ForEach(1...maxRating, id: \.self) { star in
                if interactive {
                    Button {
                        onRatingChanged?(star)
                    } label: {
                        starImage(for: star)
                            .frame(minWidth: 44, minHeight: 44)
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("Sätt betyg \(star) av \(maxRating)")
                } else {
                    starImage(for: star)
                }
            }
        }
        .accessibilityElement(children: interactive ? .contain : .ignore)
        .accessibilityLabel(interactive ? "" : "\(rating) av \(maxRating) stjärnor")
        .accessibilityValue(interactive ? "\(rating) av \(maxRating)" : "")
    }

    private func starImage(for star: Int) -> some View {
        Image(systemName: star <= rating ? "star.fill" : "star")
            .font(font)
            .foregroundStyle(star <= rating ? .orange : .gray)
    }
}
