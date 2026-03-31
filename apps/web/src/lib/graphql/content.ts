import { gql } from "@apollo/client";

export const USER_ARTICLES_QUERY = gql`
  query UserArticles($userId: String!, $limit: Int) {
    userArticles(userId: $userId, limit: $limit) {
      id
      title
      slug
      headlineImageUrl
      views
      karma
      createdAt
      user {
        id
        displayName
      }
    }
  }
`;

export const USER_GENCASTS_QUERY = gql`
  query UserGencasts($userId: String!, $limit: Int) {
    userGencasts(userId: $userId, limit: $limit) {
      id
      title
      slug
      headlineImageUrl
      views
      karma
      createdAt
      user {
        id
        displayName
      }
    }
  }
`;
