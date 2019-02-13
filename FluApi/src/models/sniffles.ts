// Copyright (c) 2018, 2019 by Audere
//
// Use of this source code is governed by an MIT-style license that
// can be found in the LICENSE file distributed with this file.

import { Sequelize } from "sequelize";
import {
  defineModel,
  Inst,
  Model,
  SplitSql,
  stringColumn,
  booleanColumn,
  jsonColumn,
  integerColumn,
  unique,
} from "../util/sql"
import {
  DeviceInfo,
  LogLevel,
  LogBatchInfo,
  VisitPIIInfo,
  VisitNonPIIDbInfo
} from "audere-lib/snifflesProtocol";
import { defineHutchUpload } from "./hutchUpload";

export function defineSnifflesModels(sql: SplitSql): SnifflesModels {
  const hutchUpload = defineHutchUpload(sql);
  const visitNonPii = defineVisit<VisitNonPIIDbInfo>(sql.nonPii);
  visitNonPii.hasOne(
    hutchUpload,
    {
      foreignKey: "visitId",
      onDelete: "CASCADE",
    }
  );
  return {
    accessKey: defineAccessKey(sql),
    clientLog: defineClientLog(sql),
    clientLogBatch: defineLogBatch(sql),
    feedback: defineFeedback(sql),
    visitNonPii,
    visitPii: defineVisit(sql.pii),
  }
}
export interface SnifflesModels {
  accessKey: Model<AccessKeyAttributes>;
  clientLog: Model<ClientLogAttributes>;
  clientLogBatch: Model<LogBatchAttributes>;
  feedback: Model<FeedbackAttributes>;
  visitNonPii: Model<VisitAttributes<VisitNonPIIDbInfo>>;
  visitPii: Model<VisitAttributes<VisitPIIInfo>>;
}

interface AccessKeyAttributes {
  id?: string;
  key: string;
  valid: boolean;
}
export function defineAccessKey(sql: SplitSql): Model<AccessKeyAttributes> {
  return defineModel<AccessKeyAttributes>(
    sql.nonPii,
    "fever_access_keys",
    {
      key: stringColumn(),
      valid: booleanColumn()
    }
  );
}

// ---------------------------------------------------------------

interface ClientLogAttributes {
  id?: string;
  log: string;
  level: LogLevel;
  device: DeviceInfo;
}
export function defineClientLog(sql: SplitSql): Model<ClientLogAttributes> {
  return defineModel<ClientLogAttributes>(
    sql.nonPii,
    "fever_client_logs",
    {
      device: jsonColumn(),
      log: stringColumn(),
      level: integerColumn(),
    }
  );
}

// ---------------------------------------------------------------

export interface LogBatchAttributes {
  id?: string;
  device: DeviceInfo;
  csruid: string;
  batch: LogBatchInfo;
}
export type LogBatchInstance = Inst<LogBatchAttributes>;
export function defineLogBatch(sql: SplitSql): Model<LogBatchAttributes> {
  return defineModel<LogBatchAttributes>(
    sql.nonPii,
    "fever_client_log_batches",
    {
      device: jsonColumn(),
      csruid: unique(stringColumn()),
      batch: jsonColumn()
    }
  );
}

// ---------------------------------------------------------------

interface FeedbackAttributes {
  id?: string;
  device: DeviceInfo;
  subject: string;
  body: string;
}
export function defineFeedback(sql: SplitSql): Model<FeedbackAttributes> {
  return defineModel<FeedbackAttributes>(
    sql.nonPii,
    "fever_feedback",
    {
      device: jsonColumn(),
      subject: stringColumn(),
      body: stringColumn(),
    }
  );
}

// ---------------------------------------------------------------

export enum VisitTableType {
  CURRENT = "visits",
  BACKUP = "visit_backups"
}

export interface VisitAttributes<Info> {
  id?: string;
  device: DeviceInfo;
  csruid: string;
  visit: Info;
}
export function defineVisit<Info>(
  sql: Sequelize,
  table = VisitTableType.CURRENT
): VisitModel<Info> {
  return defineModel<VisitAttributes<Info>>(
    sql,
    table,
    {
      device: jsonColumn(),
      csruid: unique(stringColumn()),
      visit: jsonColumn()
    }
  );
}
export type VisitInstance<Info> = Inst<VisitAttributes<Info>>;
export type VisitModel<Info> = Model<VisitAttributes<Info>>;
export type VisitNonPIIInstance = VisitInstance<VisitNonPIIDbInfo>;
export type VisitPIIInstance = VisitInstance<VisitPIIInfo>;
