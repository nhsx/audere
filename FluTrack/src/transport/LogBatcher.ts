// Copyright (c) 2018 by Audere
//
// Use of this source code is governed by an LGPL-3.0 license that
// can be found in the LICENSE file distributed with this file.

import uuidv4 from "uuid/v4";
import {
  DocumentType,
  LogRecordInfo,
  LogRecordLevel,
  LogBatchInfo,
} from "audere-lib/snifflesProtocol";
import { Pump } from "./Pump";
import { Logger } from "./LogUtil";

const DEFAULT_OPTIONS = {
  guessRecordOverheadInChars: 40,
  targetBatchSizeInChars: 64 * 1024,
  targetBatchIntervalInMs: 5 * 60 * 1000,
  maxLineLength: envAsNumber(process.env.LOG_RECORD_LIMIT, 256),
  lineTruncateTail: 50,
  pouchDbKey: "PendingLogRecords",
  echoToConsole: process.env.NODE_ENV === "development",
  uploadPriority: 3,
};

export class LogBatcher implements Logger {
  private readonly uploader: LazyUploader;
  private readonly db: any;
  private readonly buffer: LogRecordInfo[];
  private readonly pump: Pump;
  private readonly config: typeof DEFAULT_OPTIONS;

  constructor(
    uploader: LazyUploader,
    db: LogStore,
    options: ConfigOptions = {}
  ) {
    this.uploader = uploader;
    this.db = db;
    this.buffer = [];
    this.config = { ...DEFAULT_OPTIONS, ...options };
    this.echo(`Config = ${JSON.stringify(this.config)}`);

    this.pump = new Pump(() => this.pumpState(), this);
  }

  public debug(text: string): void {
    this.write(LogRecordLevel.Debug, text);
  }

  public info(text: string): void {
    this.write(LogRecordLevel.Info, text);
  }

  public warn(text: string): void {
    this.write(LogRecordLevel.Warn, text);
  }

  public error(text: string): void {
    this.write(LogRecordLevel.Error, text);
  }

  public fatal(text: string): void {
    this.write(LogRecordLevel.Fatal, text);
  }

  public write(level: LogRecordLevel, text: string): void {
    const timestamp = new Date().toISOString();
    this.echo(`${timestamp} [${level}]: ${text}`);
    this.buffer.push({ timestamp, level, text: this.truncate(text) });
    this.pump.start();
  }

  private echo(text: string) {
    if (this.config.echoToConsole) {
      console.log(text);
    }
  }

  private async pumpState(): Promise<void> {
    const uploader = this.uploader.get();

    // Nothing to do here until the uploader decrypts PouchDB since we.
    // cannot save any state.  Just buffer stuff in memory until we're
    // ready to go.
    //
    // Theoretically we should subscribe to an event so we can start up
    // when it becomes usable, but the uploader calls recursively into
    // here so we will find out soon enough once anything interesting
    // happens.
    if (uploader == null || !uploader.getIsDbDecrypted()) {
      return;
    }

    const adding = this.buffer.splice(0);
    if (adding.length > 0) {
      const state = await this.loadPending();
      const size =
        state.size + adding.reduce((acc, x) => acc + this.guessSize(x), 0);
      const records = (state == null ? [] : state.records).concat(adding);
      const durationMs = Date.now() - new Date(records[0].timestamp).getTime();
      const needsUpload =
        size > this.config.targetBatchSizeInChars ||
        durationMs > this.config.targetBatchIntervalInMs;

      this.echo(
        `LogBatcher:` +
          ` needsUpload=${needsUpload}` +
          `, adding ${adding.length}+${state.records.length}=${records.length}` +
          `, size=${size}` +
          `, dur=${durationMs}ms`
      );

      try {
        if (needsUpload) {
          const batch = {
            timestamp: new Date().toISOString(),
            records,
          };
          this.echo(
            `LogBatcher: sending ${records.length} records to DocumentUploader`
          );
          uploader.save(
            uuidv4(),
            batch,
            DocumentType.LogBatch,
            this.config.uploadPriority
          );
          this.echo(`LogBatcher: clearing Pouch state`);
          await this.db.put({ ...state, ...this.emptyState() });
          this.echo(`LogBatcher: cleared Pouch state`);
        } else {
          this.echo(`LogBatcher: writing ${records.length} records to PouchDB`);
          await this.db.put({ ...state, size, records });
        }
      } catch (e) {
        // Hope that the crash log handler can upload a bit of the log state.
        throw new Error(
          `=====\n${e}\nWhile writing log batch:\n${this.summarize(
            records
          )}\n=====`
        );
      }
    }
  }

  private async loadPending(): Promise<PendingLogState> {
    try {
      return await this.db.get(this.config.pouchDbKey);
    } catch (e) {
      return this.emptyState();
    }
  }

  private emptyState(): PendingLogState {
    return {
      _id: this.config.pouchDbKey,
      schemaId: 1,
      size: 0,
      records: [],
    };
  }

  private guessSize(record: LogRecordInfo): number {
    return (
      record.timestamp.length +
      record.level.length +
      record.text.length +
      this.config.guessRecordOverheadInChars
    );
  }

  private truncate(text: string): string {
    const max = this.config.maxLineLength;
    if (text.length < max) {
      return text;
    } else {
      const ellipses = " ... ";
      const tail = this.config.lineTruncateTail;
      const head = max - (tail + ellipses.length);
      return (
        text.substring(0, head) + ellipses + text.substring(text.length - tail)
      );
    }
  }

  private summarize(records: LogRecordInfo[]): string {
    return records
      .slice(-40)
      .reduce((acc, x) => acc + `${x.timestamp}: [${x.level}] ${x.text}\n`, "");
  }
}

function envAsNumber(env: string | undefined, defaultValue: number): number {
  if (env == null) {
    return defaultValue;
  }
  const casted = +env;
  if (isNaN(casted)) {
    return defaultValue;
  }
  return casted;
}

// Uploader emits logs, so this is circular.  Lazify our usage of DocumentUploader.
// Factoring out 'bind' here avoids making it available to users of LogBatcher.
export class LazyUploader {
  private uploader: Uploader | null = null;

  public bind(uploader: Uploader): void {
    if (this.uploader != null) {
      throw new Error("LazyUploader: uploader already set");
    }
    this.uploader = uploader;
  }

  public get(): Uploader | null {
    return this.uploader;
  }
}

export interface Uploader {
  save(
    localUid: string,
    document: LogBatchInfo,
    documentType: DocumentType,
    priority: number
  ): void;

  getIsDbDecrypted(): boolean;
}

export type PendingLogState = PendingLogState1;

interface PendingLogState1 {
  _id: string;
  schemaId: 1;
  size: number;
  records: LogRecordInfo[];
}

export interface LogStore {
  get(key: string): Promise<PendingLogState>;
  put(state: PendingLogState): Promise<void>;
}

export interface ConfigOptions {
  guessRecordOverheadInChars?: number;
  targetBatchSizeInChars?: number;
  targetBatchIntervalInMs?: number;
  maxLineLength?: number;
  lineTruncateTail?: number;
  pouchDbKey?: string;
  echoToConsole?: boolean;
  uploadPriority?: number;
}
