import { gql } from "@apollo/client";

export const VOICES_QUERY = gql`
  query Voices($userId: String) {
    voices(userId: $userId) {
      id
      name
      provider
      userId
      isDefault
    }
  }
`;

export const DELETE_VOICE_MUTATION = gql`
  mutation DeleteVoice($id: String!) {
    deleteVoice(id: $id)
  }
`;

export const CREATE_CUSTOM_VOICE_MUTATION = gql`
  mutation CreateCustomVoice($name: String!, $sampleAudioBase64: String!) {
    createCustomVoice(name: $name, sampleAudioBase64: $sampleAudioBase64) {
      id
      name
      provider
      userId
      isDefault
    }
  }
`;
