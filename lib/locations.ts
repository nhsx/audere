// Copyright (c) 2018, 2019 by Audere
//
// Use of this source code is governed by an LGPL-3.0 license that
// can be found in the LICENSE file distributed with this file.

export enum LocationType {
  Hospital = "hospital",
  CollegeCampus = "collegeCampus",
  HomelessShelter = "homelessShelter",
  ChildrensHospital = "childrensHospital",
  ChildrensClinic = "childrensClinic",
  Clinic = "clinic",
  Childcare = "childcare",
  Port = "port",
  FredHutch = "fredHutch",
  PublicSpace = "publicSpace",
}

export const Locations: {
  [key: string]: {
    type: LocationType;
    contactName: string;
    contactPhone: string;
  };
} = {
  Harborview: {
    type: LocationType.Hospital,
    contactName: "Dr. Helen Y. Chu",
    contactPhone: "(206) 897-5318",
  },
  HarborviewLobby: {
    type: LocationType.HomelessShelter,
    contactName: "Dr. Helen Y. Chu",
    contactPhone: "(206) 897-5318",
  },
  ChildrensHospitalSeattle: {
    type: LocationType.ChildrensHospital,
    contactName: "Dr. Helen Y. Chu",
    contactPhone: "(206) 897-5318",
  },
  ChildrensHospitalBellevue: {
    type: LocationType.ChildrensHospital,
    contactName: "Dr. Helen Y. Chu",
    contactPhone: "(206) 897-5318",
  },
  HUB: {
    type: LocationType.CollegeCampus,
    contactName: "Dr. Helen Y. Chu",
    contactPhone: "(206) 897-5318",
  },
  UWHallHealth: {
    type: LocationType.CollegeCampus,
    contactName: "Dr. Helen Y. Chu",
    contactPhone: "(206) 897-5318",
  },
  HealthSciencesRotunda: {
    type: LocationType.CollegeCampus,
    contactName: "Dr. Helen Y. Chu",
    contactPhone: "(206) 897-5318",
  },
  HealthSciencesLobby: {
    type: LocationType.CollegeCampus,
    contactName: "Dr. Helen Y. Chu",
    contactPhone: "(206) 897-5318",
  },
  StMartins: {
    type: LocationType.HomelessShelter,
    contactName: "Dr. Helen Y. Chu",
    contactPhone: "(206) 897-5318",
  },
  DESC: {
    type: LocationType.HomelessShelter,
    contactName: "Dr. Helen Y. Chu",
    contactPhone: "(206) 897-5318",
  },
  PioneerSquare: {
    type: LocationType.HomelessShelter,
    contactName: "Dr. Helen Y. Chu",
    contactPhone: "(206) 897-5318",
  },
  UWSeaMar: {
    type: LocationType.Clinic,
    contactName: "Dr. Helen Y. Chu",
    contactPhone: "(206) 897-5318",
  },
  ChildrensSeaMar: {
    type: LocationType.ChildrensClinic,
    contactName: "Dr. Helen Y. Chu",
    contactPhone: "(206) 897-5318",
  },
  HutchKids: {
    type: LocationType.Childcare,
    contactName: "Dr. Helen Y. Chu",
    contactPhone: "(206) 897-5318",
  },
  UWDaycare: {
    type: LocationType.Childcare,
    contactName: "Dr. Helen Y. Chu",
    contactPhone: "(206) 897-5318",
  },
  SeaTacInternational: {
    type: LocationType.Port,
    contactName: "Dr. Helen Y. Chu",
    contactPhone: "(206) 897-5318",
  },
  SeaTacDomestic: {
    type: LocationType.Port,
    contactName: "Dr. Helen Y. Chu",
    contactPhone: "(206) 897-5318",
  },
  Costco: {
    type: LocationType.Clinic,
    contactName: "Dr. Helen Y. Chu",
    contactPhone: "(206) 897-5318",
  },
  FredHutchLobby: {
    type: LocationType.FredHutch,
    contactName: "Dr. Helen Y. Chu",
    contactPhone: "(206) 897-5318",
  },
  SeattleCenter: {
    type: LocationType.PublicSpace,
    contactName: "Dr. Helen Y. Chu",
    contactPhone: "(206) 897-5318",
  },
  WestlakeMall: {
    type: LocationType.PublicSpace,
    contactName: "Dr. Helen Y. Chu",
    contactPhone: "(206) 897-5318",
  },
};
