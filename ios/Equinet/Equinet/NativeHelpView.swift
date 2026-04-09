//
//  NativeHelpView.swift
//  Equinet
//
//  Native help center with searchable article list grouped by section.
//

#if os(iOS)
import SwiftUI

struct NativeHelpView: View {
    @State private var viewModel = HelpViewModel()

    var body: some View {
        List {
            if viewModel.searchText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                // Sectioned view when not searching
                ForEach(viewModel.groupedSections) { section in
                    Section(section.name) {
                        ForEach(section.articles) { article in
                            articleRow(article)
                        }
                    }
                }
            } else {
                // Flat list during active search
                ForEach(viewModel.filteredArticles) { article in
                    articleRow(article)
                }

                if viewModel.filteredArticles.isEmpty {
                    ContentUnavailableView.search(text: viewModel.searchText)
                }
            }
        }
        .searchable(text: $viewModel.searchText, prompt: "Sök hjälpartiklar...")
        .navigationTitle("Hjälp")
        .navigationBarTitleDisplayMode(.large)
    }

    @ViewBuilder
    private func articleRow(_ article: HelpArticle) -> some View {
        NavigationLink(value: article) {
            VStack(alignment: .leading, spacing: 4) {
                Text(article.title)
                    .font(.body)
                    .fontWeight(.medium)
                Text(article.summary)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(2)
            }
            .padding(.vertical, 2)
        }
        .accessibilityLabel("\(article.title). \(article.summary)")
    }
}
#endif
