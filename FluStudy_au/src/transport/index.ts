// Copyright (c) 2018 by Audere
//
// Use of this source code is governed by an MIT-style license that
// can be found in the LICENSE file distributed with this file.

import PouchDB from "pouchdb-react-native";
import CryptoPouch from "crypto-pouch";
import URL from "url-parse";
import { Constants } from "expo";

const IS_NODE_ENV_DEVELOPMENT = process.env.NODE_ENV === "development";

PouchDB.plugin(CryptoPouch);

export function getApiBaseUrl(): string {
  let api: string;
  if (process.env.REACT_NATIVE_API_SERVER) {
    api = process.env.REACT_NATIVE_API_SERVER;
  } else if (
    IS_NODE_ENV_DEVELOPMENT &&
    process.env.REACT_NATIVE_USE_LOCAL_SERVER
  ) {
    api = `http://${new URL(Constants.manifest.bundleUrl).hostname}:3000/api`;
  } else {
    api = "https://api.staging.auderenow.io/api";
  }
  console.log(`API server: '${api}'`);
  return api;
}
