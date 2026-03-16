import { gql } from "@apollo/client";

export const YOUTUBE_LOGIN_AUTH_URL_QUERY = gql`
  query YoutubeLoginAuthUrl {
    youtubeLoginAuthUrl {
      authUrl
    }
  }
`;

export const ME_QUERY = gql`
  query Me {
    me {
      id
      displayName
      avatarUrl
      bio
      createdAt
      _count {
        articles
        gencasts
        subscribers
      }
    }
  }
`;
