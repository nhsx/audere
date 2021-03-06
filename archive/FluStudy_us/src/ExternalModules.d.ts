// Declare external modules here so that TS noImplicitAny does not give errors

declare module "react-native-video";
declare module "react-native-fbsdk";
declare module "react-native-loading-spinner-overlay";
declare module "redux-persist-transform-encrypt";
declare module "redux-persist-transform-immutable";
declare module "react-native-simple-radio-button";
declare module "react-native-check-box";
declare module "react-native-datepicker";
declare module "react-native-keyboard-listener";
declare module "react-native-modal-selector";
declare module "react-redux";
declare module "expo";
declare module "i18next";
declare module "expo-pixi";
declare module "crypto-pouch";

// pouch-crypto extension
namespace PouchDB {
  interface Database {
    crypto(password: string): void;
  }
}
