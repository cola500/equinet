//
//  HelpViewModelTests.swift
//  EquinetTests
//
//  TDD tests for HelpViewModel -- search and section grouping.
//

import XCTest
@testable import Equinet

final class HelpViewModelTests: XCTestCase {
    var viewModel: HelpViewModel!

    override func setUp() {
        super.setUp()
        viewModel = HelpViewModel()
    }

    override func tearDown() {
        viewModel = nil
        super.tearDown()
    }

    // MARK: - Grouping

    func testAllArticlesReturnedWhenSearchEmpty() {
        viewModel.searchText = ""
        XCTAssertEqual(viewModel.filteredArticles.count, providerHelpArticles.count)
    }

    func testSectionsGroupedCorrectly() {
        viewModel.searchText = ""
        let sectionNames = viewModel.groupedSections.map(\.name)
        // Should have all unique sections from the articles
        let expectedSections = Array(Set(providerHelpArticles.map(\.section)))
        XCTAssertEqual(Set(sectionNames), Set(expectedSections))
    }

    func testSectionsNotEmptyWhenNoSearch() {
        viewModel.searchText = ""
        for section in viewModel.groupedSections {
            XCTAssertFalse(section.articles.isEmpty, "Section '\(section.name)' should not be empty")
        }
    }

    // MARK: - Search by title

    func testSearchFindsArticleByTitle() {
        viewModel.searchText = "Komma igång"
        let results = viewModel.filteredArticles
        XCTAssertTrue(results.contains(where: { $0.slug == "komma-igang" }))
    }

    func testSearchIsCaseInsensitive() {
        viewModel.searchText = "komma igång"
        let results = viewModel.filteredArticles
        XCTAssertTrue(results.contains(where: { $0.slug == "komma-igang" }))
    }

    // MARK: - Search by keyword

    func testSearchFindsArticleByKeyword() {
        viewModel.searchText = "hovbeläggning"
        let results = viewModel.filteredArticles
        XCTAssertTrue(results.contains(where: { $0.slug == "hantera-tjanster" }))
    }

    // MARK: - Search by content

    func testSearchFindsArticleByParagraphContent() {
        viewModel.searchText = "checklista på din dashboard"
        let results = viewModel.filteredArticles
        XCTAssertTrue(results.contains(where: { $0.slug == "komma-igang" }))
    }

    func testSearchFindsArticleByStepContent() {
        viewModel.searchText = "Fyll i din företagsprofil"
        let results = viewModel.filteredArticles
        XCTAssertTrue(results.contains(where: { $0.slug == "komma-igang" }))
    }

    func testSearchFindsArticleBySummary() {
        viewModel.searchText = "Steg-för-steg-checklista"
        let results = viewModel.filteredArticles
        XCTAssertTrue(results.contains(where: { $0.slug == "komma-igang" }))
    }

    func testSearchFindsArticleByHeading() {
        viewModel.searchText = "Profil-fliken"
        let results = viewModel.filteredArticles
        XCTAssertTrue(results.contains(where: { $0.slug == "foretagsprofil" }))
    }

    // MARK: - No match

    func testSearchReturnsEmptyForNoMatch() {
        viewModel.searchText = "xyznonexistent123"
        XCTAssertTrue(viewModel.filteredArticles.isEmpty)
    }

    // MARK: - Flat results during search

    func testGroupedSectionsIsEmptyDuringActiveSearch() {
        viewModel.searchText = "Komma igång"
        // When searching, groupedSections should be empty (UI shows flat list instead)
        XCTAssertTrue(viewModel.groupedSections.isEmpty)
    }
}
