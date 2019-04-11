// Copyright (c) 2018 by Audere
//
// Use of this source code is governed by an MIT-style license that
// can be found in the LICENSE file distributed with this file.

import { SecretConfig } from "./secretsConfig";

export interface REDCapConfig {
  apiToken: string,
  apiUrl: string,
  homeDataReportId: number
}

let lazy: Promise<REDCapConfig> | null = null;

export function getREDCapConfig(
  secrets: SecretConfig
): Promise<REDCapConfig> {
  if (lazy != null) {
    return lazy;
  }
  lazy = createConfig(secrets);
  return lazy;
}

async function createConfig(secrets: SecretConfig): Promise<REDCapConfig> {
  const [apiToken, apiUrl, homeDataReportId] = await Promise.all([
    secrets.get("REDCAP_API_TOKEN"),
    secrets.get("REDCAP_API_URL"),
    +secrets.get("REDCAP_HOME_DATA_REPORT_ID")
  ]);
  return { apiToken, apiUrl, homeDataReportId };
}