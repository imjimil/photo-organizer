"""Tests for search query parsing."""

import unittest

from opal.search import enrich_plan_text_search, parse_search


class ParseSearchTests(unittest.TestCase):
    def test_quoted_exact_phrase(self):
        plan = parse_search('"be yourself"')
        self.assertEqual(plan.exact_phrases, ["be yourself"])
        self.assertEqual(plan.vibe_text, "")
        self.assertEqual(plan.mode, "exact")

    def test_exact_colon_operator(self):
        plan = parse_search("exact:quote")
        self.assertEqual(plan.exact_phrases, ["quote"])

    def test_include_exclude_words(self):
        plan = parse_search("+warmth -screenshot")
        self.assertEqual(plan.include_words, ["warmth"])
        self.assertEqual(plan.exclude_words, ["screenshot"])

    def test_folder_operators(self):
        plan = parse_search("in:2024 -in:archive")
        self.assertEqual(plan.include_folders, ["2024"])
        self.assertEqual(plan.exclude_folders, ["archive"])

    def test_date_range(self):
        plan = parse_search("after:2024-01-01 before:2025-01-01")
        self.assertEqual(plan.date_after, "2024-01-01")
        self.assertEqual(plan.date_before, "2025-01-01")

    def test_during_year(self):
        plan = parse_search("during:2024")
        self.assertEqual(plan.date_after, "2024-01-01")
        self.assertEqual(plan.date_before, "2025-01-01")

    def test_content_operators(self):
        self.assertIs(parse_search("has:text").has_text, True)
        self.assertIs(parse_search("visual:").has_text, False)

    def test_match_and_vibe(self):
        plan = parse_search("match:strict warmth")
        self.assertEqual(plan.match, "strict")
        self.assertEqual(plan.vibe_text, "warmth")
        self.assertEqual(plan.mode, "vibe")

    def test_filter_only_mode(self):
        plan = parse_search("in:2024 has:text")
        self.assertEqual(plan.mode, "filter_only")
        self.assertEqual(plan.include_folders, ["2024"])
        self.assertIs(plan.has_text, True)

    def test_hybrid_mode(self):
        plan = parse_search('warmth "be yourself"')
        self.assertEqual(plan.vibe_text, "warmth")
        self.assertEqual(plan.exact_phrases, ["be yourself"])
        self.assertEqual(plan.mode, "hybrid")

    def test_enrich_single_word_adds_ocr(self):
        plan = parse_search("fat")
        enrich_plan_text_search(plan)
        self.assertEqual(plan.include_words, ["fat"])
        self.assertEqual(plan.mode, "hybrid")

    def test_enrich_quoted_only_skips_vibe(self):
        plan = parse_search('"fat"')
        enrich_plan_text_search(plan)
        self.assertEqual(plan.exact_phrases, ["fat"])
        self.assertEqual(plan.include_words, [])

    def test_enrich_multi_word_adds_phrase(self):
        plan = parse_search("motivational quote")
        enrich_plan_text_search(plan)
        self.assertEqual(plan.exact_phrases, ["motivational quote"])
        self.assertEqual(plan.include_words, [])

    def test_enrich_skips_visual_only(self):
        plan = parse_search("sunset")
        plan.has_text = False
        enrich_plan_text_search(plan)
        self.assertEqual(plan.include_words, [])


if __name__ == "__main__":
    unittest.main()
