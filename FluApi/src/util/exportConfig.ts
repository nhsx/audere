// Copyright (c) 2018 by Audere
//
// Use of this source code is governed by an LGPL-3.0 license that
// can be found in the LICENSE file distributed with this file.

import { SecretConfig } from "./secretsConfig";

export const defaultNumEncounters: number = +process.env.NUM_ENCOUNTERS || 100;

export const hutchConcurrentUploads: number =
  +process.env.HUTCH_CONCURRENT_UPLOADS || 50;

export async function getHashSecret(secrets: SecretConfig): Promise<string> {
  return secrets.get("EXPORT_HASH_SECRET");
}
