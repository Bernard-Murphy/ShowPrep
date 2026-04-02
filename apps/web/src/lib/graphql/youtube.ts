import { gql } from "@apollo/client";

export const YOUTUBE_AUTH_URL_QUERY = gql`
  query YouTubeAuthUrl {
    youtubeAuthUrl {
      authUrl
    }
  }
`;

export const YOUTUBE_SUBSCRIPTIONS_QUERY = gql`
  query YouTubeSubscriptions {
    youtubeSubscriptions {
      id
      channelId
      channelTitle
      channelThumbnailUrl
      subscriberCount
      lastUploadedAt
      active
    }
  }
`;

export const SYNC_YOUTUBE_SUBSCRIPTIONS_MUTATION = gql`
  mutation SyncYouTubeSubscriptions {
    syncYouTubeSubscriptions
  }
`;

export const SET_YOUTUBE_SELECTION_MUTATION = gql`
  mutation SetYouTubeSubscriptionSelection($channelIds: [String!]!) {
    setYouTubeSubscriptionSelection(channelIds: $channelIds)
  }
`;

export const UNLINK_YOUTUBE_MUTATION = gql`
  mutation UnlinkYouTube {
    unlinkYouTube
  }
`;
