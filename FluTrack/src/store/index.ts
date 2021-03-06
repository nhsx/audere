// Copyright (c) 2019 by Audere
//
// Use of this source code is governed by an LGPL-3.0 license that
// can be found in the LICENSE file distributed with this file.

import { createStore, combineReducers, applyMiddleware } from "redux";
import { persistStore, persistReducer } from "redux-persist";
import storage from "redux-persist/lib/storage";
import immutableTransform from "redux-persist-transform-immutable";

import { uploaderMiddleware } from "./uploader";

import { default as form, FormState, FormAction } from "./form";
export * from "./form";

import { default as admin, AdminState, AdminAction } from "./admin";
export * from "./admin";

export type Action = FormAction | AdminAction;

export { StoreState } from "./StoreState";

const persistConfig = {
  transforms: [immutableTransform()],
  key: "store",
  storage,
};

const reducer = combineReducers({
  form,
  admin,
});

export const store = createStore(
  persistReducer(persistConfig, reducer),
  applyMiddleware(uploaderMiddleware)
);
export const persistor = persistStore(store);
