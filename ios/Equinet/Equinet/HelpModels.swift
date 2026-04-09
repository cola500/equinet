//
//  HelpModels.swift
//  Equinet
//
//  Data models for help center articles.
//

#if os(iOS)
import Foundation

struct HelpContent {
    let heading: String?
    let paragraphs: [String]
    let steps: [String]
    let bullets: [String]
    let tip: String?

    init(
        heading: String? = nil,
        paragraphs: [String] = [],
        steps: [String] = [],
        bullets: [String] = [],
        tip: String? = nil
    ) {
        self.heading = heading
        self.paragraphs = paragraphs
        self.steps = steps
        self.bullets = bullets
        self.tip = tip
    }
}

struct HelpArticle: Identifiable, Hashable {
    static func == (lhs: HelpArticle, rhs: HelpArticle) -> Bool { lhs.slug == rhs.slug }
    func hash(into hasher: inout Hasher) { hasher.combine(slug) }

    let slug: String
    let title: String
    let section: String
    let keywords: [String]
    let summary: String
    let content: [HelpContent]

    var id: String { slug }

    /// All searchable text combined for filtering.
    var searchableText: String {
        let parts: [String] = [
            title,
            summary,
            keywords.joined(separator: " "),
            content.flatMap { block in
                var texts: [String] = []
                if let heading = block.heading { texts.append(heading) }
                texts.append(contentsOf: block.paragraphs)
                texts.append(contentsOf: block.steps)
                texts.append(contentsOf: block.bullets)
                if let tip = block.tip { texts.append(tip) }
                return texts
            }.joined(separator: " "),
        ]
        return parts.joined(separator: " ")
    }
}

struct HelpSection: Identifiable {
    let name: String
    let articles: [HelpArticle]
    var id: String { name }
}
#endif
