// Copyright (c) 2019 by Audere
//
// Use of this source code is governed by an LGPL-3.0 license that
// can be found in the LICENSE file distributed with this file.

import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import {
  NotificationRequest,
  PatientInfo,
  HealthWorkerInfo,
  EncounterInfo,
  FirestoreProtocolDocument,
  TransportMetadata,
  DeviceInfo,
} from "audere-lib/dist/ebPhotoStoreProtocol";
import { SessionsClient } from "dialogflow";
// @ts-ignore: Apparently types not yet available for dialogflow-fulfillment
import { WebhookClient } from "dialogflow-fulfillment";
import * as uuid from "uuid";
import axios from "axios";
import * as fs from "fs";
import * as tmp from "tmp";

admin.initializeApp();

export const notify = functions.https.onCall(async (data, context) => {
  if (context.auth == null) {
    console.error(`Received unauthorized notification request`);
    return;
  } else {
    console.log(`Received notification request from ${context.auth.uid}`);
  }

  const notification = data as NotificationRequest;
  const document: admin.messaging.DataMessagePayload = {};

  Object.keys(notification.notification).forEach(key => {
    document[key] = (notification.notification as any)[key].toString();
  });

  const payload = {
    data: document,
    notification: {
      title: notification.title,
      body: notification.body,
      sound: "default",
      android_channel_id: "eb_photo_store",
    },
  };

  let options = {};
  if (notification.group != null) {
    options = {
      collapseKey: notification.group,
      priority: "high",
    };
  }

  const sendResponse = await admin
    .messaging()
    .sendToDevice(notification.token, payload, options);

  const result = sendResponse.results[0];

  if (result.error != null) {
    console.error(
      `Notification was not sent successfully: ` + result.error.message
    );
  }
});

export const googleCloudApiKey = functions.https.onCall(() => {
  return functions.config().eb.google_cloud_api_key;
});

export const onReceiveWhatsApp = functions.https.onRequest(
  async (request, response) => {
    const params = request.body;
    let message = undefined;

    if (params.NumMedia == 1) {
      await onCompletePatientRecord(
        getMobileFromSessionId(params.From),
        params.MediaUrl0
      );
      message =
        "Thank you for uploading a photo of the test result! " +
        "When you're ready to submit the next patient, type 'New patient.'";
    } else {
      const sessionId = params.From;
      const sessionClient = new SessionsClient();
      const sessionPath = sessionClient.sessionPath(
        "ebphotostore-staging",
        sessionId
      );

      // The text query request.
      const request = {
        session: sessionPath,
        queryInput: {
          text: {
            // The query to send to the dialogflow agent
            text: params.Body,
            // The language used by the client (en-US)
            languageCode: "en-US",
          },
        },
      };

      // Send request and log result
      const responses = await sessionClient.detectIntent(request);
      const result = responses[0].queryResult;

      message = result.fulfillmentText;
    }

    response.set("Content-Type", "text/plain");
    response.status(200).send(message);
  }
);

type DialogFlowContext = {
  name: string;
  lifespan: number;
  parameters: {
    [key: string]: any;
  };
};

type PatientDemographics = {
  givenName: string;
  lastName: string;
  age: number;
  gender: "male" | "female";
  mobile: string;
};

type CHWContext = {
  chwGivenName: string;
  chwLastName: string;
};

type WebhookAgent = {
  parameters: {
    [key: string]: any;
  };
  session: string;
  intent: string;
  add: (message: string) => void;
  context: {
    get: (contextName: string) => DialogFlowContext;
  };
};

exports.onDialogFlowWebhook = functions.https.onRequest(
  async (request, response) => {
    const agent = new WebhookClient({ request, response });

    // Useful for future debugging
    // console.log(`Intent ${agent.intent} received on ${agent.session}`);

    // Map from Dialogflow intent names to functions to be run when the
    // intent is matched
    let intentMap = new Map();
    //console.log(agent.intent, agent.parameters);

    intentMap.set("Patient Demographics", onNewPatient);
    intentMap.set("CHW Welcome Followup - yes", onNewCHW);
    //intentMap.set("Edit Patient", onEditPatient);
    intentMap.set("Edit Patient - First Name", onEditPatientFirstName);
    intentMap.set("Edit Patient - Last Name", onEditPatientLastName);
    intentMap.set("Edit Patient - Gender", onEditPatientGender);
    intentMap.set("Edit Patient - Number", onEditPatientNumber);
    intentMap.set("Edit Patient - Age", onEditPatientAge);
    intentMap.set("List Patients", onListPatients);

    agent.handleRequest(intentMap);
  }
);

async function onEditPatientAge(agent: WebhookAgent) {
  const newAge = agent.parameters.age;
  //console.log(agent.parameters);
  //console.log(agent.context)
  await admin
    .firestore()
    .collection("whatsAppPatients")
    .doc("3334444222")
    .update({ age: newAge });
  let message = "Updated age to " + newAge;
  agent.add(message);
}

async function onEditPatientFirstName(agent: WebhookAgent) {
  const newName = agent.parameters.name;
  await admin
    .firestore()
    .collection("whatsAppPatients")
    .doc("3334444222")
    .update({ givenName: newName });
  let message = "Updated first name to " + newName;
  agent.add(message);
}

async function onEditPatientLastName(agent: WebhookAgent) {
  const newName = agent.parameters.name;
  await admin
    .firestore()
    .collection("whatsAppPatients")
    .doc("3334444222")
    .update({ lastName: newName });
  let message = "Updated last name to " + newName;
  agent.add(message);
}
async function onEditPatientGender(agent: WebhookAgent) {
  const newGender = agent.parameters.gender;
  await admin
    .firestore()
    .collection("whatsAppPatients")
    .doc("3334444222")
    .update({ gender: newGender });
  let message = "Updated gender to " + newGender;
  agent.add(message);
}

async function onEditPatientNumber(agent: WebhookAgent) {
  const newNumber = agent.parameters.number;
  await admin
    .firestore()
    .collection("whatsAppPatients")
    .doc("3334444222")
    .update({ mobile: newNumber });
  let message = "Updated phone number to " + newNumber;
  agent.add(message);
}

async function onListPatients(agent: WebhookAgent) {
  const patientDocs = await admin
    .firestore()
    .collection("whatsAppPatients")
    .where("chwMobile", "==", getCHWMobile(agent))
    .get();
  const patientDemos = patientDocs.docs.map(
    doc => doc.data() as PatientDemographics
  );
  let message = patientDemos.reduce(
    (accumulator, currentValue, currentIndex) =>
      accumulator +
      `${currentIndex + 1}: ${currentValue.givenName} ${
        currentValue.lastName
      }, ${currentValue.age}, ${currentValue.gender}, ${
        currentValue.mobile
      } \n\n`,
    "Here are your patients:\n\n"
  );
  agent.add(message);
}

function getFinalContextParams(
  agent: WebhookAgent,
  contextName: string
): { [key: string]: number | string } | undefined {
  const fullContext = agent.context.get(contextName);

  if (fullContext) {
    let params = {};

    for (let key in fullContext.parameters) {
      if (!key.endsWith(".original")) {
        // @ts-ignore: This 'any' treatment is harmless
        params[key] = fullContext.parameters[key];
      }
    }

    return params;
  }
  return undefined;
}

const WHATSAPP_PREFIX = "whatsapp:";

function getCHWMobile(agent: WebhookAgent): string {
  const sessionParts = agent.session.split("/");
  const sessionId = sessionParts[sessionParts.length - 1];

  return getMobileFromSessionId(sessionId);
}

function getMobileFromSessionId(sessionId: string) {
  if (sessionId.startsWith(WHATSAPP_PREFIX)) {
    return sessionId.substring(WHATSAPP_PREFIX.length);
  }
  return sessionId;
}

async function getCHWContextFromMobile(mobile: string) {
  const chwSnap = await admin
    .firestore()
    .collection("whatsAppCHWs")
    .doc(mobile)
    .get();
  if (chwSnap.exists) {
    return chwSnap.data() as CHWContext;
  }
  return undefined;
}

async function getCHWGivenName(agent: WebhookAgent): Promise<string> {
  const chwContext = getFinalContextParams(agent, "chwwelcome-followup-yes") as
    | CHWContext
    | undefined;
  if (chwContext && chwContext.chwGivenName) {
    return chwContext.chwGivenName;
  }
  const chwFromFirebase = await getCHWContextFromMobile(getCHWMobile(agent));
  if (chwFromFirebase) {
    return chwFromFirebase.chwGivenName;
  }
  console.log(`Unexpectedly didn't find CHW record for ${getCHWMobile(agent)}`);
  return "Community Health Worker";
}

async function onNewPatient(agent: WebhookAgent) {
  const patientContext = getFinalContextParams(agent, "patientdemographics") as
    | PatientDemographics
    | undefined;
  if (patientContext) {
    const possessive = patientContext.gender === "male" ? "his" : "her";
    const [chwGivenName] = await Promise.all([
      getCHWGivenName(agent),
      admin
        .firestore()
        .collection("whatsAppPatients")
        .doc(patientContext.mobile as string)
        .set({
          ...patientContext,
          chwMobile: getCHWMobile(agent),
          updatedAt: new Date().toISOString(),
        }),
    ]);
    agent.add(
      `Thank you for registering ${patientContext.givenName}, ` +
        `${chwGivenName}! Please send a photo of ` +
        `${patientContext.givenName}'s ` +
        `Ebola diagnostic test to complete ${possessive} record.`
    );
  } else {
    console.log(`No patient context in ${JSON.stringify(agent.context)}`);
  }
}

async function onNewCHW(agent: WebhookAgent) {
  const chwContext = getFinalContextParams(agent, "chwwelcome-followup-yes") as
    | CHWContext
    | undefined;
  if (chwContext) {
    const chw = {
      ...chwContext,
      mobile: getCHWMobile(agent),
    };

    await admin
      .firestore()
      .collection("whatsAppCHWs")
      .doc(chw.mobile)
      .set(chw);
    agent.add(
      `Thank you for registering as a community health worker, ` +
        `${chw.chwGivenName}!  Whenever you'd like to register a new patient, ` +
        `just say, "New patient."`
    );
  } else {
    console.log(`No CHW context in ${JSON.stringify(agent.context)}`);
  }
}

async function getOrCreateUid(chwMobile: string) {
  try {
    const user = await admin.auth().getUserByPhoneNumber(chwMobile);
    return user.uid;
  } catch {
    const chwRecord = await getCHWContextFromMobile(chwMobile);
    const chwFullName = chwRecord
      ? `${chwRecord.chwGivenName} ${chwRecord.chwLastName}`
      : "unknown";
    const user = await admin
      .auth()
      .createUser({ phoneNumber: chwMobile, displayName: chwFullName });

    return user.uid;
  }
}

async function getLatestPatient(
  chwMobile: string
): Promise<
  { patient: PatientDemographics; totalPatients: number } | undefined
> {
  const snaps = await admin
    .firestore()
    .collection("whatsAppPatients")
    .where("chwMobile", "==", chwMobile)
    .orderBy("updatedAt", "desc")
    .get();

  if (snaps.empty) {
    console.log(`Couldn't find latest patient for CHW ${chwMobile}`);
    return undefined;
  }

  return {
    patient: snaps.docs[0].data() as PatientDemographics,
    totalPatients: snaps.docs.length,
  };
}

async function createEncounterDoc(
  docId: string,
  chwMobile: string,
  photoId: string
): Promise<FirestoreProtocolDocument | undefined> {
  const timestamp = new Date().toISOString();
  const _transport: TransportMetadata = {
    lastWriter: "sender",
    protocolVersion: 1,
    sentAt: timestamp,
  };
  const device: DeviceInfo = {
    clientBuild: "10001",
    clientVersion: {
      buildDate: "20190816",
      hash: "randomhashstringforcloudfunction",
      name: "EbPhotoSiteCloudFunction",
      version: "1.0",
    },
    idiomText: "WhatsApp",
    installation: chwMobile,
    platform: {
      osName: "unknown",
      osVersion: "unknown",
    },
  };
  const [uid, chwContext, patientData] = await Promise.all([
    getOrCreateUid(chwMobile),
    getCHWContextFromMobile(chwMobile),
    getLatestPatient(chwMobile),
  ]);

  if (!chwContext || !patientData) {
    console.log(`Failed to get CHW ${chwMobile} or latest patient.`);
    return undefined;
  }
  const patientDemographics = patientData.patient;
  const patient: PatientInfo = {
    firstName: patientDemographics.givenName,
    lastName: patientDemographics.lastName,
    phone: patientDemographics.mobile,
  };
  const healthWorker: HealthWorkerInfo = {
    firstName: chwContext.chwGivenName,
    lastName: chwContext.chwLastName,
    notes: "",
    phone: chwMobile,
    uid,
  };
  const encounter: EncounterInfo = {
    healthWorker,
    isDemo: false,
    localIndex: (patientData.totalPatients - 1).toString(),
    notes: "",
    patient,
    rdtPhotos: [
      {
        gps: getPhotoGPS(),
        photoId,
        timestamp,
      },
    ],
    updatedAt: timestamp,
  };
  const doc: FirestoreProtocolDocument = {
    _transport,
    device,
    docId,
    // @ts-ignore DocumentType is declared an enum.  When deployed to Firebase
    // Cloud Functions, the server side can't find these enums.
    documentType: "ENCOUNTER",
    encounter,
    schemaId: 1,
  };
  return doc;
}

// Lame for now, will soon extract from EXIF.  Hardcoded to Bay Area right now.
function getPhotoGPS() {
  return {
    latitude: "37.4219983",
    longitude: "-122.084",
  };
}

async function downloadUri(uri: string) {
  const response = await axios.request({
    responseType: "arraybuffer",
    url: uri,
    method: "get",
    headers: {
      "Content-Type": "image/jpeg",
    },
  });
  const localFile = tmp.tmpNameSync();
  fs.writeFileSync(localFile, response.data);
  return localFile;
}

async function onCompletePatientRecord(chwMobile: string, photoUri: string) {
  const photoId = uuid();
  let localFile = null;

  try {
    localFile = await downloadUri(photoUri);
    await admin
      .storage()
      .bucket()
      .upload(localFile, {
        destination: `photos/${photoId}.jpg`,
        contentType: "image/jpeg",
      });
  } finally {
    if (localFile) {
      fs.unlinkSync(localFile);
    }
  }

  const docId = uuid();
  const encounter = await createEncounterDoc(docId, chwMobile, photoId);

  if (encounter) {
    await admin
      .firestore()
      .collection("encounters")
      .doc(docId)
      .set(encounter);
  } else {
    console.log(`Could not create an encounter for ${chwMobile}`);
  }
}
