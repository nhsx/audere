// Copyright (c) 2019 by Audere
//
// Use of this source code is governed by an LGPL-3.0 license that
// can be found in the LICENSE file distributed with this file.

import { SurveyQuestionData } from "../../../resources/QuestionnaireConfig";

export const PostCollectionQuestions = {
  WereThereAdverse: {
    buttons: [],
    id: "WereThereAdverse",
    title:
      "Were there any adverse events experienced from the last collection?",
    optionList: {
      options: ["Yes", "No"],
      multiSelect: false,
      withOther: false,
    },
  },
  WhichProcedures: {
    buttons: [],
    id: "WhichProcedures",
    title: "Which procedures had adverse events?",
    optionList: {
      options: ["Blood draw", "Nasal swab"],
      multiSelect: true,
      withOther: false,
    },
  },
  BloodDrawEvents: {
    buttons: [],
    id: "BloodDrawEvents",
    title: "For blood draw, what were the adverse events?",
    optionList: {
      options: ["Bruising at site", "Infection at site", "Other"],
      multiSelect: true,
      withOther: true,
      otherPlaceholder: "Adverse event",
    },
  },
  NasalSwabEvents: {
    buttons: [],
    id: "NasalSwabEvents",
    title: "For nasal swab, what were the adverse events?",
    optionList: {
      options: ["Nosebleed", "Other"],
      multiSelect: true,
      withOther: true,
      otherPlaceholder: "Adverse event",
    },
  },
};

export const OptionKeyToQuestion: { [key: string]: SurveyQuestionData } = {
  "Blood draw": PostCollectionQuestions.BloodDrawEvents,
  "Nasal swab": PostCollectionQuestions.NasalSwabEvents,
};
