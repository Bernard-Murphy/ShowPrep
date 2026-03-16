import { gql } from "@apollo/client";

export const HOT_ARTICLES_QUERY = gql`
  query HotArticles($limit: Int) {
    hotArticles(limit: $limit) {
      id
      title
      slug
      headlineImageUrl
      views
      karma
      hotScore
      createdAt
      user {
        id
        displayName
      }
    }
  }
`;

export const HOT_GENCASTS_QUERY = gql`
  query HotGencasts($limit: Int) {
    hotGencasts(limit: $limit) {
      id
      title
      slug
      headlineImageUrl
      views
      karma
      hotScore
      createdAt
      user {
        id
        displayName
      }
    }
  }
`;

export const FEED_QUERY = gql`
  query Feed(
    $filter: String
    $sort: String
    $search: String
    $limit: Int
    $cursor: String
  ) {
    feed(
      filter: $filter
      sort: $sort
      search: $search
      limit: $limit
      cursor: $cursor
    ) {
      edges {
        node {
          ... on ArticleEntity {
            id
            type: __typename
            title
            slug
            headlineImageUrl
            views
            karma
            hotScore
            createdAt
            user {
              id
              displayName
            }
          }
          ... on GencastEntity {
            id
            type: __typename
            title
            slug
            headlineImageUrl
            views
            karma
            hotScore
            createdAt
            user {
              id
              displayName
            }
          }
        }
        cursor
      }
      nextCursor
    }
  }
`;
