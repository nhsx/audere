// Copyright (c) 2018 by Audere
//
// Use of this source code is governed by an MIT-style license that
// can be found in the LICENSE file distributed with this file.

// ========================================================================
//
// PLEASE NOTE:
//
// If you need to change types here sometime after we store real data:
// Because these types are used across client/server, we have to maintain
// compatibility.  The two ways of doing this are:
//   1) Add a new optional field.
//   2) Bump the top-level schemaId, and create a new version of each
//      container type from the modified type up to the root of the
//      containment tree.
//
// ========================================================================

export interface ProtocolDocumentBase {
  documentType: string;
  schemaId: number;

  // cryptographically secure unique id for this document.
  csruid: string;

  // information about client device
  device: DeviceInfo;
}

export enum DocumentType {
  Visit = 'VISIT',
  VisitCore = 'VISIT_CORE',
  VisitIdentity = 'VISIT_IDENTITY',
  Feedback = 'FEEDBACK',
  Log = 'LOG',
}

export type ProtocolDocument =
    FeedbackDocument
  | LogDocument
  | VisitDocument;

export interface DeviceInfo {
  installation: string; // uuid
  clientVersion: string;
  deviceName: string;
  yearClass: string;
  idiomText: string;
  platform: string;
}

// ================================================================================
// Visit

export interface VisitDocument extends ProtocolDocumentBase {
  documentType: DocumentType.Visit;
  schemaId: 1;
  visit: VisitInfo;
}

export interface VisitCoreDocument extends ProtocolDocumentBase {
  documentType: DocumentType.VisitCore;
  schemaId: 1;
  visit: VisitCoreInfo;
}

export interface VisitIdentityDocument extends ProtocolDocumentBase {
  documentType: DocumentType.VisitIdentity;
  schemaId: 1;
  visit: VisitIdentityInfo;
}

export type VisitInfo = VisitCoreInfo & VisitIdentityInfo;

export interface VisitCoreInfo extends VisitCommonInfo {
  samples: SampleInfo[];
  giftcards: GiftCardInfo[];

  // Filtered to include only non-identity information, like health data.
  responses: ResponseInfo[];
}

// Defined here because it is a variant of VisitInfo
export interface VisitIdentityInfo extends VisitCommonInfo {
  gps_location?: GpsLocationInfo;
  patient: PatientInfo;
  consents: ConsentInfo[];

  // Filtered to include only identity information, like name, email, and address.
  responses: ResponseInfo[];
}

// Common to Core and Identity visit info.
export interface VisitCommonInfo {
  complete: boolean;
  location?: string;
  administrator?: string;
  events: EventInfo[];
}

export interface GpsLocationInfo {
  latitude: string;
  longitude: string;
}

// Information about swabs or other physical samples collected during visit
export interface SampleInfo {
  // Possible values TBD
  sample_type: string;
  // Value read from the test kit's QR code, or another unique identifier
  code: string;
}

// Information about gift cards given to participants
export interface GiftCardInfo {
    barcodeType: string;
    code: string;
    giftcardType: string;
}

// This is a subset of the FHIR 'Patient' resource
// https://www.hl7.org/fhir/patient.html
export interface PatientInfo {
  name?: string;
  birthDate?: string; // FHIR:date
  gender?: PatientInfoGender;
  telecom: TelecomInfo[];
  address: AddressInfo[];
}

// The following options come from:
// https://www.hl7.org/fhir/valueset-administrative-gender.html
export enum PatientInfoGender {
  Male = "male",
  Female = "female",
  Other = "other",
  Unknown = "unknown",
}

export interface TelecomInfo {
  system: TelecomInfoSystem;
  value: string;
}

export enum TelecomInfoSystem {
  Phone = "phone",
  SMS = "sms",
  Email = "email",
}

export interface AddressInfo extends AddressValueInfo {
  use: AddressInfoUse;
}

export enum AddressInfoUse {
  Home = "home",
  Work = "work",
}

export interface ConsentInfo {
    name: string;
    terms: string;
    signerType: ConsentInfoSignerType;
    date: string; // date only
    signature: string; // Base64-encoded PNG of the signature
    relation?: string;
}

export enum ConsentInfoSignerType {
  Subject = "Subject",
  Parent = "Parent",
  Representative = "Representative",
}

// This is loosely based on the FHIR 'QuestionnaireResponse' resource
// https://www.hl7.org/fhir/questionnaireresponse.html
export interface ResponseInfo {
  id: string;
  item: ResponseItemInfo[];
}

export interface ResponseItemInfo extends QuestionInfo {
  answer: AnswerInfo[];
}

export interface QuestionInfo {
  // human-readable, locale-independent id of the question
  id: string;
  // localized text of question
  text: string;
  // For multiple-choice questions, the exact text of each option, in order
  answerOptions?: QuestionAnswerOption[];
}

export interface QuestionAnswerOption {
  id: string;
  text: string;
}

export interface AnswerInfo {
  valueBoolean?: boolean;
  valueDateTime?: string; // FHIR:dateTime
  valueDecimal?: number;
  valueInteger?: number;
  valueString?: string;
  valueAddress?: AddressValueInfo;

  // If the selected option also has a freeform text box, e.g
  // 'Other, please specify: _________'
  valueOther?: OtherValueInfo;

  // True if the patiented declined to respond to the question
  valueDeclined?: boolean;
}

export interface AddressValueInfo {
  line: string[];
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

export interface OtherValueInfo {
  // Index in answerOptions of the selected choice
  selectedIndex: Number;
  valueString: string;
}

export interface EventInfo {
  kind: EventInfoKind;

  at: string; // FHIR:instant
  until?: string; // FHIR:instant

  // id of the item this event describes (e.g. question id), if applicable
  refId?: string;
}

export enum EventInfoKind {
  Visit = "visit",
  Response = "response",
  Sample = "sample",
}

// ================================================================================
// Feedback

export interface FeedbackDocument extends ProtocolDocumentBase {
  documentType: DocumentType.Feedback;
  schemaId: 1;
  feedback: FeedbackInfo;
}

export interface FeedbackInfo {
  subject: string;
  body: string;
}


// ================================================================================
// Log

export interface LogDocument extends ProtocolDocumentBase {
  documentType: DocumentType.Log;
  schemaId: 1;
  log: LogInfo;
}

export interface LogInfo {
  // TODO (ram): batch
  logentry: string;
}
