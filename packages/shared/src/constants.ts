export const PROCESS_LIMIT_DEFAULT = 100;

export const FEED_SORT_OPTIONS = [
  "hot",
  "newest",
  "oldest",
  "popular",
] as const;
export type FeedSortOption = (typeof FEED_SORT_OPTIONS)[number];

export const FEED_FILTER_OPTIONS = ["all", "articles", "gencasts"] as const;
export type FeedFilterOption = (typeof FEED_FILTER_OPTIONS)[number];
