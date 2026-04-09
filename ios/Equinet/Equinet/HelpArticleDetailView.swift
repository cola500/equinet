//
//  HelpArticleDetailView.swift
//  Equinet
//
//  Renders a single help article with paragraphs, steps, bullets, tips and headings.
//

#if os(iOS)
import SwiftUI

struct HelpArticleDetailView: View {
    let article: HelpArticle

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                // Section badge
                Text(article.section)
                    .font(.caption)
                    .fontWeight(.medium)
                    .padding(.horizontal, 10)
                    .padding(.vertical, 4)
                    .background(Color.equinetGreen.opacity(0.15))
                    .foregroundStyle(Color.equinetGreen)
                    .clipShape(Capsule())

                // Summary
                Text(article.summary)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)

                // Content blocks
                ForEach(Array(article.content.enumerated()), id: \.offset) { _, block in
                    contentBlockView(block)
                }
            }
            .padding()
        }
        .navigationTitle(article.title)
        .navigationBarTitleDisplayMode(.inline)
    }

    // MARK: - Content block rendering

    @ViewBuilder
    private func contentBlockView(_ block: HelpContent) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            if let heading = block.heading {
                Text(heading)
                    .font(.headline)
                    .padding(.top, 4)
                    .accessibilityAddTraits(.isHeader)
            }

            ForEach(block.paragraphs, id: \.self) { paragraph in
                Text(paragraph)
                    .font(.body)
            }

            if !block.steps.isEmpty {
                VStack(alignment: .leading, spacing: 6) {
                    ForEach(Array(block.steps.enumerated()), id: \.offset) { index, step in
                        HStack(alignment: .top, spacing: 8) {
                            Text("\(index + 1).")
                                .font(.body)
                                .fontWeight(.semibold)
                                .foregroundStyle(Color.equinetGreen)
                                .frame(width: 24, alignment: .trailing)
                            Text(step)
                                .font(.body)
                        }
                    }
                }
            }

            if !block.bullets.isEmpty {
                VStack(alignment: .leading, spacing: 6) {
                    ForEach(block.bullets, id: \.self) { bullet in
                        HStack(alignment: .top, spacing: 8) {
                            Text("\u{2022}")
                                .font(.body)
                                .foregroundStyle(.secondary)
                            Text(bullet)
                                .font(.body)
                        }
                    }
                }
            }

            if let tip = block.tip {
                HStack(alignment: .top, spacing: 10) {
                    Image(systemName: "lightbulb")
                        .foregroundStyle(.orange)
                        .font(.body)
                    Text(tip)
                        .font(.callout)
                }
                .padding(12)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(Color.orange.opacity(0.08))
                .clipShape(RoundedRectangle(cornerRadius: 8))
            }
        }
    }
}
#endif
