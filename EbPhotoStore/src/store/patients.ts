// Copyright (c) 2019 by Audere
//
// Use of this source code is governed by an MIT-style license that
// can be found in the LICENSE file distributed with this file.

import uuidv4 from "uuid/v4";
import deepEqual from "deep-equal";

import {
  AuthUser,
  Message,
  PatientInfo,
  PhotoInfo
} from "audere-lib/ebPhotoStoreProtocol";

export type LocalPhotoInfo = {
  photoInfo: PhotoInfo;
  localPath: string;
};

export type PatientEncounter = {
  id: number;
  uuid: string;
  patientInfo: PatientInfo;
  notes?: string;
  triageNotes?: string;
  photoInfo: LocalPhotoInfo[];
  evdPositive?: boolean;
  messages: Message[];
};

export type PatientAction =
  | {
      type: "ADD_PATIENT";
      patientInfo: PatientInfo;
      notes?: string;
    }
  | {
      type: "UPDATE_PATIENT";
      id: number;
      patientInfo: PatientInfo;
      notes?: string;
    }
  | {
      type: "SAVE_PHOTO";
      patientId: number;
      photoUri: string;
      photoInfo: PhotoInfo;
    }
  | {
      type: "SEND_MESSAGE";
      patientId: number;
      message: Message;
    }
  | {
      type: "RECEIVE_MESSAGE";
      patientUuid: string;
      message: Message;
    }
  | { type: "SET_EVD_STATUS"; id: number; evdStatus: boolean }
  | { type: "SET_TRIAGE_NOTES"; id: number; notes: string };

export type PatientState = PatientEncounter[];

const initialState: PatientState = [];

export default function reducer(
  state = initialState,
  action: PatientAction
): PatientState {
  switch (action.type) {
    case "ADD_PATIENT":
      return [
        ...state,
        {
          id: state.length,
          uuid: uuidv4(),
          patientInfo: action.patientInfo,
          notes: action.notes,
          photoInfo: [],
          messages: []
        }
      ];
    case "UPDATE_PATIENT":
      return state.map((patient, index) => {
        if (index != action.id) {
          return patient;
        }
        return {
          ...patient,
          patientInfo: action.patientInfo,
          notes: action.notes
        };
      });
    case "RECEIVE_MESSAGE":
      return state.map((patient, index) => {
        if (patient.uuid != action.patientUuid) {
          return patient;
        }
        if (
          patient.messages.some(message => deepEqual(message, action.message))
        ) {
          return patient;
        }
        return {
          ...patient,
          messages: [...(patient.messages || []), action.message]
        };
      });
      break;
    case "SEND_MESSAGE":
      return state.map((patient, index) => {
        if (index != action.patientId) {
          return patient;
        }
        return {
          ...patient,
          messages: [...(patient.messages || []), action.message]
        };
      });
    case "SET_EVD_STATUS":
      return state.map((patient, index) => {
        if (index != action.id) {
          return patient;
        }
        return {
          ...patient,
          evdPositive: action.evdStatus
        };
      });
    case "SET_TRIAGE_NOTES":
      return state.map((patient, index) => {
        if (index != action.id) {
          return patient;
        }
        return {
          ...patient,
          triageNotes: action.notes
        };
      });

    case "SAVE_PHOTO":
      return state.map((patient, index) => {
        if (index != action.patientId) {
          return patient;
        }
        return {
          ...patient,
          photoInfo: [
            ...patient.photoInfo,
            {
              photoInfo: action.photoInfo,
              localPath: action.photoUri
            }
          ]
        };
      });
    default:
      return state;
  }
}

export function addPatient(
  patientInfo: PatientInfo,
  notes?: string
): PatientAction {
  return {
    type: "ADD_PATIENT",
    patientInfo,
    notes
  };
}

export function updatePatient(
  id: number,
  patientInfo: PatientInfo,
  notes?: string
): PatientAction {
  return {
    type: "UPDATE_PATIENT",
    id,
    patientInfo,
    notes
  };
}

export function sendChatMessage(
  patientId: number,
  message: Message
): PatientAction {
  return {
    type: "SEND_MESSAGE",
    patientId,
    message
  };
}

export function receiveChatMessage(
  patientUuid: string,
  message: Message
): PatientAction {
  return {
    type: "RECEIVE_MESSAGE",
    patientUuid,
    message
  };
}

export function setEvdStatus(id: number, evdStatus: boolean): PatientAction {
  return {
    type: "SET_EVD_STATUS",
    id,
    evdStatus
  };
}

export function setTriageNotes(id: number, notes: string): PatientAction {
  return {
    type: "SET_TRIAGE_NOTES",
    id,
    notes
  };
}

export function savePhoto(
  patientId: number,
  photoUri: string,
  photoInfo: PhotoInfo
): PatientAction {
  return {
    type: "SAVE_PHOTO",
    patientId,
    photoUri,
    photoInfo
  };
}
