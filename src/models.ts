export interface ArticleSuggestion {
  url: string;
  tag: string;
}

export interface Suggestion extends ArticleSuggestion {
  id?: number;
  suggestedAt: Date[];
}
