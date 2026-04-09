//
//  HelpViewModel.swift
//  Equinet
//
//  ViewModel for help center -- search and section grouping.
//

#if os(iOS)
import Foundation
import Observation

@Observable
final class HelpViewModel {
    var searchText: String = ""

    /// All articles matching current search text. Returns all articles when search is empty.
    var filteredArticles: [HelpArticle] {
        let query = searchText.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard !query.isEmpty else { return providerHelpArticles }
        return providerHelpArticles.filter { article in
            article.searchableText.lowercased().contains(query)
        }
    }

    /// Articles grouped by section. Empty when search is active (UI shows flat list instead).
    var groupedSections: [HelpSection] {
        guard searchText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return [] }

        // Preserve section order from the articles array
        var seen = Set<String>()
        var order: [String] = []
        for article in providerHelpArticles {
            if !seen.contains(article.section) {
                seen.insert(article.section)
                order.append(article.section)
            }
        }

        return order.compactMap { sectionName in
            let articles = providerHelpArticles.filter { $0.section == sectionName }
            return articles.isEmpty ? nil : HelpSection(name: sectionName, articles: articles)
        }
    }
}
#endif
