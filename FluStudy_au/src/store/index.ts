// Copyright (c) 2019 by Audere
//
// Use of this source code is governed by an LGPL-3.0 license that
// can be found in the LICENSE file distributed with this file.

import base64url from "base64url";
import {
  createStore,
  combineReducers,
  applyMiddleware,
  Store,
  Middleware,
  Dispatch,
  AnyAction,
  MiddlewareAPI,
} from "redux";
import { persistStore, persistReducer, createTransform } from "redux-persist";
import storage from "redux-persist/lib/storage";
import { Transform } from "redux-persist/es/createTransform";
import immutableTransform from "redux-persist-transform-immutable";
import * as SecureStore from "expo-secure-store";
import { uploaderMiddleware } from "./uploader";
import { crashlytics, crashReportingDetailsMiddleware } from "../crashReporter";
import {
  logFirebaseEvent,
  AppHealthEvents,
  TransportEvents,
} from "../util/tracker";
import { PhotoUploader } from "../transport/PhotoUploader";

export * from "./types";

import { default as meta, MetaAction } from "./meta";
export * from "./meta";

import { default as questions, QuestionsAction } from "./questions";
export * from "./questions";

import { default as survey, SurveyAction } from "./survey";
export * from "./survey";

type ClearStateAction = { type: "CLEAR_STATE" };
export function clearState(): ClearStateAction {
  return { type: "CLEAR_STATE" };
}

export type Action =
  | MetaAction
  | QuestionsAction
  | SurveyAction
  | ClearStateAction;

import { StoreState } from "./StoreState";
import { photoCollectionName } from "./FirebaseStore";
export { StoreState } from "./StoreState";

const reducer = combineReducers({
  meta,
  navigation: (state: any = {}) => null,
  questions,
  survey,
});

const rootReducer = (state: StoreState | undefined, action: Action) => {
  if (action.type === "CLEAR_STATE") {
    if (state != null) {
      Object.keys(state).forEach(key => {
        storage.removeItem(`persist:${key}`);
      });
    }
    state = undefined;
  }
  return reducer(state, action);
};

let storePromise: Promise<Store>;
export function getStore(): Promise<Store> {
  if (storePromise) {
    return storePromise;
  }
  return (storePromise = getStoreImpl());
}

const photoUploader = new PhotoUploader({
  collection: photoCollectionName(),
});

export function savePhoto(photoId: string, jpegBase64: string) {
  logFirebaseEvent(TransportEvents.PHOTO_UPDATED, { photoId });
  return photoUploader.savePhoto(photoId, jpegBase64);
}

export async function hasPendingPhotos() {
  return await photoUploader.hasPendingPhotos();
}

export async function waitForIdlePhotoUploader(ms?: number) {
  return await photoUploader.waitForIdle(ms);
}

function loggingMiddleware<Ext, S, D extends Dispatch>(
  label: string,
  middleware: Middleware<Ext, S, D>
): Middleware<Ext, S, D> {
  return (store: MiddlewareAPI<D, S>) => {
    const inner0 = middleware(store);
    return (next: Dispatch) => {
      const inner1 = inner0(next);
      return (action: AnyAction) => {
        const before = `middleware[${label}] ${action}`;
        if (!store) {
          crashlytics.log(`${before} (store='${store}')`);
        } else if (!store.getState()) {
          crashlytics.log(`${before} (store.getState()='${store.getState()}')`);
        } else {
          crashlytics.log(before);
        }

        const result = inner1(action);

        crashlytics.log(`middleware[${label}] ${action} -> ${result}`);
        return result;
      };
    };
  };
}

async function getStoreImpl() {
  const persistConfig = {
    transforms: [immutableTransform()],
    key: "store",
    storage,
  };
  return createStore(
    persistReducer(persistConfig, rootReducer),
    applyMiddleware(
      loggingMiddleware("CrashReport", crashReportingDetailsMiddleware),
      loggingMiddleware("Upload", uploaderMiddleware)
    )
  );
}

export async function getPersistor() {
  return persistStore(await getStore());
}
