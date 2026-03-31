import { gql } from "@apollo/client";

export const START_HARVEST_MUTATION = gql`
  mutation StartHarvest($type: String) {
    startHarvest(type: $type) {
      id
      status
      stage
      message
      progress
      processedCount
      totalCount
      error
      createdAt
    }
  }
`;

export const LATEST_PROCESSING_JOB_QUERY = gql`
  query LatestProcessingJob {
    latestProcessingJob {
      id
      status
      stage
      message
      progress
      processedCount
      totalCount
      error
      createdAt
      completedAt
    }
  }
`;
