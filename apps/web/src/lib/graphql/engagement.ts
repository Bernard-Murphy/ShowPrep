import { gql } from "@apollo/client";

export const USER_VOTE_QUERY = gql`
  query UserVote($targetType: String!, $targetId: String!) {
    userVote(targetType: $targetType, targetId: $targetId)
  }
`;

export const VOTE_MUTATION = gql`
  mutation Vote($targetType: String!, $targetId: String!, $value: Float!) {
    vote(targetType: $targetType, targetId: $targetId, value: $value)
  }
`;

export const COMMENTS_QUERY = gql`
  query Comments($targetType: String!, $targetId: String!, $profileUserId: String) {
    comments(targetType: $targetType, targetId: $targetId, profileUserId: $profileUserId) {
      id
      text
      createdAt
      karma
      user {
        id
        displayName
        avatarUrl
      }
      replies {
        id
        text
        createdAt
        karma
        user {
          id
          displayName
          avatarUrl
        }
      }
    }
  }
`;

export const CREATE_COMMENT_MUTATION = gql`
  mutation CreateComment(
    $targetType: String!
    $targetId: String
    $profileUserId: String
    $text: String!
    $repliesTo: String
  ) {
    createComment(
      targetType: $targetType
      targetId: $targetId
      profileUserId: $profileUserId
      text: $text
      repliesTo: $repliesTo
    ) {
      id
      text
      createdAt
      karma
      user {
        id
        displayName
        avatarUrl
      }
    }
  }
`;
