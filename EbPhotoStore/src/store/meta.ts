// Copyright (c) 2019 by Audere
//
// Use of this source code is governed by an MIT-style license that
// can be found in the LICENSE file distributed with this file.

export enum Screen {
  Login = "LOGIN",
  Patients = "PATIENTS",
  PatientDetails = "PATIENT_DETAILS",
  Camera = "CAMERA"
}

export type ChwData = {
  lastName: string;
  firstName: string;
  phone: string;
  notes?: string;
};

export type MetaAction =
  | { type: "LOGIN"; chwData: ChwData }
  | { type: "LOGOUT" }
  | { type: "VIEW_PATIENTS" }
  | { type: "VIEW_DETAILS"; id: number }
  | { type: "OPEN_CAMERA" };

export type MetaState = {
  currentPatient?: number;
  chwData?: ChwData;
  screen: Screen;
};

const initialState: MetaState = {
  screen: Screen.Login
};

export default function reducer(state = initialState, action: MetaAction) {
  switch (action.type) {
    case "LOGIN":
      return {
        ...state,
        currentPatient: undefined,
        chwData: action.chwData,
        screen: Screen.Patients
      };
    case "LOGOUT":
      return {
        ...state,
        currentPatient: undefined,
        chwData: undefined,
        screen: Screen.Login
      };
    case "VIEW_PATIENTS":
      return {
        ...state,
        currentPatient: undefined,
        screen: Screen.Patients
      };
    case "VIEW_DETAILS":
      return {
        ...state,
        currentPatient: action.id,
        screen: Screen.PatientDetails
      };
    case "OPEN_CAMERA":
      return {
        ...state,
        screen: Screen.Camera
      };
    default:
      return state;
  }
}

export function login(chwData: ChwData): MetaAction {
  return {
    type: "LOGIN",
    chwData
  };
}

export function logout(): MetaAction {
  return {
    type: "LOGOUT"
  };
}

export function viewPatients(): MetaAction {
  return {
    type: "VIEW_PATIENTS"
  };
}

export function viewDetails(id: number): MetaAction {
  return {
    type: "VIEW_DETAILS",
    id
  };
}

export function openCamera(): MetaAction {
  return {
    type: "OPEN_CAMERA"
  };
}
