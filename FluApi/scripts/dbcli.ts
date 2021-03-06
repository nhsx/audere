#!/usr/bin/env ts-node
// Copyright (c) 2018, 2019 by Audere
//
// Use of this source code is governed by an LGPL-3.0 license that
// can be found in the LICENSE file distributed with this file.

import os, { tmpdir } from "os";
import { join as pjoin } from "path";
import { spawn } from "child_process";
import fs from "fs";
import { promisify } from "util";
import { createInterface as createReadline } from "readline";
import Sequelize from "sequelize";
import { cast, literal, Op } from "sequelize";
import yargs from "yargs";
import _ from "lodash";
import base64url from "base64url";
import bufferXor from "buffer-xor";
import { Crypt as HybridCrypto } from "hybrid-crypto-js";
import firebase from "firebase-admin";

import { ScriptLogger } from "./util/script_logger";
import { VisitNonPIIUpdater, VisitPIIUpdater } from "./util/visit_updater";
import { partPath, getPart, setPart } from "./util/pathEdit";
import {
  createSplitSql,
  nonPiiDatabaseUrl,
  piiDatabaseUrl,
  Inst,
} from "../src/util/sql";
import { generateRandomKey } from "../src/util/crypto";
import { Locations as snifflesLocations } from "audere-lib/locations";
import {
  defineSnifflesModels,
  VisitAttributes,
  VisitInstance,
  VisitModel,
} from "../src/models/db/sniffles";
import {
  ClientVersionInfo as SnifflesClientVersionInfo,
  DeviceInfo as SnifflesDevice,
  LogRecordInfo,
  VisitNonPIIDbInfo,
  VisitNonPIIInfo,
  VisitPIIInfo,
} from "audere-lib/snifflesProtocol";
import {
  defineFeverModels,
  PhotoAttributes as FeverPhotoAttributes,
  SurveyAttributes,
  SurveyInstance,
  SurveyModel,
} from "../src/models/db/fever";
import { defineCoughModels } from "../src/models/db/cough";
import {
  DeviceInfo as FeverDevice,
  EventInfo,
  SurveyNonPIIDbInfo,
  PIIInfo,
} from "audere-lib/feverProtocol";
import {
  SurveyNonPIIUpdater,
  SurveyPIIUpdater,
} from "./util/feverSurveyUpdater";
import { PhotoAttributes as CoughPhotoAttributes } from "../src/models/db/cough";
import { Updater } from "./util/updater";
import { AuthManager, Permission } from "../src/endpoints/webPortal/auth";
import { defineDeviceSetting } from "../src/models/db/devices";
import { extractVisitNonPii } from "../src/endpoints/snifflesApi";
import { extractVisitPii } from "../src/endpoints/snifflesApi";
import { addDemoGiftcards } from "../src/endpoints/coughGiftcardApi";
import { defineChillsModels } from "../src/models/db/chills";

const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);
const mkdtemp = promisify(fs.mkdtemp);
const unlink = promisify(fs.unlink);
const rmdir = promisify(fs.rmdir);

const log = new ScriptLogger(console.log);

type App = firebase.app.App;
type Firestore = firebase.firestore.Firestore;
type DocumentSnapshot = firebase.firestore.DocumentSnapshot;

const sql = createSplitSql();
const snifflesModels = defineSnifflesModels(sql);
const feverModels = defineFeverModels(sql);
const coughModels = defineCoughModels(sql);
const chillsModels = defineChillsModels(sql);
const auth = new AuthManager(sql);
const deviceSetting = defineDeviceSetting(sql);

const hybridCrypto = new HybridCrypto();

const UTF8 = "UTF-8";

type SnifflesNonPiiUpdater = Updater<
  VisitAttributes<VisitNonPIIInfo>,
  VisitNonPIIInfo,
  SnifflesDevice
>;
type SnifflesPiiUpdater = Updater<
  VisitAttributes<VisitPIIInfo>,
  VisitPIIInfo,
  SnifflesDevice
>;
type FeverNonPiiUpdater = Updater<
  SurveyAttributes<SurveyNonPIIDbInfo>,
  SurveyNonPIIDbInfo,
  FeverDevice
>;
type FeverPiiUpdater = Updater<SurveyAttributes<PIIInfo>, PIIInfo, FeverDevice>;
type SomeUpdater =
  | SnifflesNonPiiUpdater
  | SnifflesPiiUpdater
  | FeverNonPiiUpdater
  | FeverPiiUpdater;
type SomeDevice = SnifflesDevice | FeverDevice;

type SomeSurveyModel = SurveyModel<PIIInfo | SurveyNonPIIDbInfo>;
type SomeSurveyInstance = SurveyInstance<PIIInfo | SurveyNonPIIDbInfo>;
type SomeVisitModel = VisitModel<VisitPIIInfo | VisitNonPIIDbInfo>;
type SomeVisitInstance = VisitInstance<VisitPIIInfo | VisitNonPIIDbInfo>;
type SomePhotoInstance =
  | Inst<CoughPhotoAttributes>
  | Inst<FeverPhotoAttributes>;

type PerReleaseUpdater<TNonPii, TPii> = {
  nonPii: TNonPii;
  pii: TPii;
};
type SnifflesUpdater = PerReleaseUpdater<
  SnifflesNonPiiUpdater,
  SnifflesPiiUpdater
>;
type FeverUpdater = PerReleaseUpdater<FeverNonPiiUpdater, FeverPiiUpdater>;

const sniffles: SnifflesUpdater = {
  nonPii: new VisitNonPIIUpdater(sql, log),
  pii: new VisitPIIUpdater(sql, log),
};

const fever: FeverUpdater = {
  nonPii: new SurveyNonPIIUpdater(sql.nonPii, log),
  pii: new SurveyPIIUpdater(sql.pii, log),
};

enum Release {
  Sniffles = "sniffles",
  Fever = "fever",
  Cough = "cough",
  Chills = "chills",
}

yargs.strict(true);
yargs.option("verbose", {
  alias: "v",
  boolean: true,
  global: true,
});
yargs.command({
  command: "by-created <release> <start> <end>",
  builder: yargs =>
    yargs
      .string("release")
      .string("start")
      .string("end"),
  handler: command(cmdByCreated),
});
yargs.command({
  command: "by-consent-date <release> <date>",
  builder: yargs => yargs.string("release").string("date"),
  handler: command(cmdByConsentDate),
});
yargs.command({
  command: "by-email <release> <email>",
  builder: yargs => yargs.string("email"),
  handler: command(cmdByEmail),
});
yargs.command({
  command: "by-name <release> <first> <last>",
  builder: yargs => yargs.string("first").string("last"),
  handler: command(cmdByName),
});
yargs.command({
  command: "by-samples <release> <types>",
  builder: yargs => yargs.string("release").string("types"),
  handler: command(cmdBySamples),
});
yargs.command({
  command: "show-path <release> <kind> <path> <rows>",
  builder: yargs =>
    yargs
      .string("release")
      .string("kind")
      .string("path")
      .string("rows"),
  handler: command(cmdShowPath),
});
yargs.command({
  command: "photo <release> <csruid>",
  builder: yargs => yargs.string("release").string("csruid"),
  handler: command(cmdPhoto),
});
yargs.command({
  command: "photo-of <release> <row>",
  builder: yargs => yargs.string("release").string("row"),
  handler: command(cmdPhotoOf),
});
yargs.command({
  command: "sample-of <release> <type> <row>",
  builder: yargs =>
    yargs
      .string("release")
      .string("type")
      .string("row"),
  handler: command(cmdSampleOf),
});
yargs.command({
  command: "demo <release> <row> [value]",
  builder: yargs => yargs.string("row").boolean("value"),
  handler: command(cmdDemo),
});
yargs.command({
  command: "demo1 <release> <kind> <row> [value]",
  builder: yargs =>
    yargs
      .string("release")
      .string("kind")
      .string("row")
      .option("value", { boolean: true }),
  handler: command(cmdDemo1),
});
yargs.command({
  command: "set-administrator <value> <row>",
  builder: yargs => yargs.string("value").string("row"),
  handler: command(cmdSetSnifflesAdministrator),
});
yargs.command({
  command: "set-location <value> <row>",
  builder: yargs => yargs.string("value").string("row"),
  handler: command(cmdSetSnifflesLocation),
});
yargs.command({
  command: "upload <release> <row>",
  describe:
    "Removes marker that a row is already uploaded to Hutch, " +
    "hopefully to trigger another upload next time around.",
  builder: yargs => yargs.string("release").string("row"),
  handler: command(cmdUpload),
});
yargs.command({
  command: "generate-random-key [size]",
  builder: yargs =>
    yargs.option("size", {
      number: true,
    }),
  handler: command(cmdGenerateRandomKey),
});
yargs.command({
  command: "add-access-key <release> <key>",
  builder: yargs => yargs.string("release"),
  handler: command(cmdAddAccessKey),
});
yargs.command({
  command: "create-access-key <release>",
  builder: yargs => yargs.string("release"),
  handler: command(cmdCreateAccessKey),
});
yargs.command({
  command: "show-access-key <release> <part>",
  builder: yargs => yargs.string("release").string("part"),
  handler: command(cmdShowAccessKey),
});
yargs.command({
  command: "show <release> <kind> <row>",
  builder: yargs => yargs.string("kind").string("row"),
  handler: command(cmdShow),
});
yargs.command({
  command: "edit <release> <kind> <path> <row>",
  builder: yargs =>
    yargs
      .string("release")
      .string("kind")
      .string("path")
      .string("row"),
  handler: command(cmdEdit),
});
yargs.command({
  // Fever-only
  command: "docev <csruid>",
  builder: yargs => yargs.string("crsuid"),
  handler: command(cmdDocumentEvents),
});
yargs.command({
  command: "log <release> [since] [until] [device] [text]",
  builder: yargs =>
    yargs
      .string("release")
      .positional("since", {
        describe: "earliest timestamp to search",
        default: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      })
      .positional("until", {
        describe: "latest timestamp to search",
        default: new Date(Date.now()),
      })
      .positional("device", {
        describe: "regular expression to search in device name or id",
        default: ".?",
      })
      .positional("text", {
        describe: "regular expression to search in log lines",
        default: ".?",
      }),
  handler: command(cmdLog),
});
yargs.command({
  command: "adduser <userid> <password>",
  builder: yargs => yargs.string("userid").string("password"),
  handler: command(cmdAdd),
});
yargs.command({
  command: "passwd <userid> <password>",
  builder: yargs => yargs.string("userid").string("password"),
  handler: command(cmdPasswd),
});
yargs.command({
  command: "set-device-setting <installationId> <key> <value>",
  builder: yargs =>
    yargs
      .string("installationId")
      .string("key")
      .string("value"),
  handler: command(cmdSetDeviceSetting),
});
yargs.command({
  command: "clear-device-setting <installationId> <key>",
  builder: yargs => yargs.string("installationId").string("key"),
  handler: command(cmdClearDeviceSetting),
});
yargs.command({
  command: "grant-permission <userid> <permission>",
  builder: yargs => yargs.string("userid").string("permission"),
  handler: command(cmdGrantPermission),
});
yargs.command({
  command: "revoke-permission <userid> <permission>",
  builder: yargs => yargs.string("userid").string("permission"),
  handler: command(cmdRevokePermission),
});
yargs.command({
  command: "recover-visit <barcode>",
  builder: yargs => yargs.string("barcode"),
  handler: command(cmdRecoverVisit),
});
yargs.command({
  command: "add-demo-cough-giftcards <count> <denomination>",
  builder: yargs => yargs.number("count").number("denomination"),
  handler: command(cmdAddDemoCoughGiftcards),
});
yargs.demandCommand().argv;

function command(cmd: any) {
  return async (argv: any) => {
    log.setVerbose(argv.verbose);
    try {
      await cmd(argv);
    } catch (err) {
      if (err.checked) {
        console.error(`Error: ${err.message}`);
      } else {
        throw err;
      }
    } finally {
      await sql.close();
      log.close();
    }
  };
}

interface DeviceSettingArgs {
  installationId: string;
  key: string;
  value: string;
}

async function cmdSetDeviceSetting(argv: DeviceSettingArgs) {
  await deviceSetting.upsert({
    device: argv.installationId,
    key: argv.key,
    setting: argv.value,
  });
}

async function cmdClearDeviceSetting(argv: DeviceSettingArgs) {
  await deviceSetting.destroy({
    where: {
      device: argv.installationId,
      key: argv.key,
    },
  });
}

interface UserPasswordArgs {
  userid: string;
  password: string;
}
async function cmdAdd(argv: UserPasswordArgs): Promise<void> {
  await auth.createUser(argv.userid, argv.password);
}

async function cmdPasswd(argv: UserPasswordArgs): Promise<void> {
  await auth.setPassword(argv.userid, argv.password);
}

interface PhotosArgs {
  release: Release;
  csruid: string;
}

async function cmdPhoto(argv: PhotosArgs): Promise<void> {
  const csruid = argv.csruid;
  let rows: SomePhotoInstance[];
  switch (argv.release) {
    case Release.Chills:
      rows = await chillsModels.photo.findAll({
        where: { docid: { [Op.like]: `${csruid}%` } },
      });
      break;
    case Release.Cough:
      rows = await coughModels.photo.findAll({
        where: { docid: { [Op.like]: `${csruid}%` } },
      });
      break;
    case Release.Fever:
      rows = await feverModels.photo.findAll({
        where: { csruid: { [Op.like]: `${csruid}%` } },
      });
      break;
    case Release.Sniffles:
      throw fail("Sniffles doesn't have photos");
    default:
      throw failRelease(argv.release);
  }

  switch (rows.length) {
    case 0:
      throw new Error(`No photo found with csruid '${csruid}'`);
    case 1:
      console.log(rows[0].photo.jpegBase64);
      break;
    default:
      throw new Error(
        `Multiple records found: '${rows
          .map((row: any) => pubId(row.csruid || row.docId))
          .join("', '")}'`
      );
  }
}

interface PhotoOfArgs {
  release: Release;
  row: string;
}

async function cmdPhotoOf(argv: PhotoOfArgs): Promise<void> {
  switch (argv.release) {
    case Release.Chills: {
      const surveyRow = expectOne(
        await chillsModels.survey.findAll({
          where: { docid: { [Op.like]: `${argv.row}%` } },
        })
      );
      const sample = expectOne(
        surveyRow.survey.samples.filter(
          x => x.sample_type === "TestStripBase64"
        )
      );
      const photoRow = expectOne(
        await chillsModels.photo.findAll({
          where: { docid: { [Op.eq]: sample.code } },
        })
      );
      console.log(photoRow.photo.jpegBase64);
      break;
    }
    case Release.Cough: {
      const surveyRow = expectOne(
        await coughModels.survey.findAll({
          where: { docid: { [Op.like]: `${argv.row}%` } },
        })
      );
      const sample = expectOne(
        surveyRow.survey.samples.filter(
          x => x.sample_type === "TestStripBase64"
        )
      );
      const photoRow = expectOne(
        await coughModels.photo.findAll({
          where: { docid: { [Op.eq]: sample.code } },
        })
      );
      console.log(photoRow.photo.jpegBase64);
      break;
    }

    case Release.Fever: {
      const surveyRow = expectOne(
        await feverModels.surveyNonPii.findAll({
          where: { csruid: { [Op.like]: `${argv.row}%` } },
        })
      );
      const sample = expectOne(
        surveyRow.survey.samples.filter(
          x => x.sample_type === "TestStripBase64"
        )
      );
      const photoRow = expectOne(
        await feverModels.photo.findAll({
          where: { csruid: { [Op.eq]: sample.code } },
        })
      );
      console.log(photoRow.photo.jpegBase64);
      break;
    }
    case Release.Sniffles:
      throw fail("Sniffles doesn't have photos");
    default:
      throw failRelease(argv.release);
  }
}

interface SampleOfArgs {
  release: Release;
  row: string;
  type: string;
}

async function cmdSampleOf(argv: SampleOfArgs): Promise<void> {
  switch (argv.release) {
    case Release.Fever: {
      const surveyRow = expectOne(
        await feverModels.surveyNonPii.findAll({
          where: { csruid: { [Op.like]: `${argv.row}%` } },
        })
      );
      const sample = expectOne(
        surveyRow.survey.samples.filter(x => x.sample_type === argv.type)
      );
      console.log(sample.code);
      break;
    }
    case Release.Sniffles:
      throw fail("Sniffles support not yet implemented");
    default:
      throw failRelease(argv.release);
  }
}

interface ByDateArgs {
  release: Release;
  date: string;
}

async function cmdByConsentDate(argv: ByDateArgs): Promise<void> {
  switch (argv.release) {
    case Release.Sniffles: {
      const rows = await snifflesModels.visitNonPii.findAll({
        where: {
          [Op.and]: [
            { visit: { isDemo: false } },
            Sequelize.literal(
              `lower(visit->>'consents')::jsonb @> '[{"date":"${argv.date}"}]'`
            ),
          ],
        },
      });
      consoleLogRows(rows);
      break;
    }
    case Release.Fever: {
      const rows = await feverModels.surveyNonPii.findAll({
        where: {
          [Op.and]: [
            { survey: { isDemo: false } },
            Sequelize.literal(
              `lower(survey->>'consents')::jsonb @> '[{"date":"${argv.date}"}]'`
            ),
          ],
        },
      });
      consoleLogRows(rows);
      break;
    }
    default:
      throw failRelease(argv.release);
  }
}

interface ByEmailArgs {
  release: Release;
  email: string;
}

async function cmdByEmail(argv: ByEmailArgs): Promise<void> {
  switch (argv.release) {
    case Release.Sniffles: {
      const rows = await snifflesModels.visitPii.findAll({
        where: {
          [Op.and]: [
            { visit: { isDemo: false } },
            Sequelize.literal(`
              lower(visit->'patient'->>'telecom')::jsonb @>
              lower('[{"value":"${argv.email}"}]')
            `),
          ],
        },
      });
      consoleLogRows(rows);
      break;
    }
    case Release.Fever: {
      const rows = await feverModels.surveyPii.findAll({
        where: {
          [Op.and]: [
            { survey: { isDemo: false } },
            Sequelize.literal(`
              lower(survey->'patient'->>'telecom')::jsonb @>
              lower('[{"value":"${argv.email}"}]')
            `),
          ],
        },
      });
      consoleLogRows(rows);
      break;
    }
    default:
      throw failRelease(argv.release);
  }
}

interface ByNameArgs {
  release: string;
  kind: string;
  first: string;
  last: string;
}

async function cmdByName(argv: ByNameArgs): Promise<void> {
  switch (argv.release) {
    case Release.Sniffles: {
      const rows = await snifflesModels.visitPii.findAll({
        where: {
          visit: {
            isDemo: false,
            patient: {
              name: {
                [Op.iLike]: `%${argv.first}%${argv.last}%`,
              },
            },
          },
        },
      });
      consoleLogRows(rows);
      break;
    }
    case Release.Fever: {
      const rows = await feverModels.surveyPii.findAll({
        where: {
          survey: {
            isDemo: false,
            patient: {
              firstName: {
                [Op.iLike]: `%argv.first%`,
              },
              lastName: {
                [Op.iLike]: `%argv.last%`,
              },
            },
          },
        },
      });
      consoleLogRows(rows);
      break;
    }
    default:
      throw failRelease(argv.release);
  }
}

interface ByCreatedArgs {
  release: Release;
  start: string;
  end: string;
}

async function cmdByCreated(argv: ByCreatedArgs): Promise<void> {
  switch (argv.release) {
    case Release.Sniffles: {
      const rows = await snifflesModels.visitNonPii.findAll({
        where: {
          [Op.and]: [
            { visit: { isDemo: false } },
            { createdAt: { [Op.gte]: argv.start } },
            { createdAt: { [Op.lte]: argv.end } },
          ],
        },
      });
      consoleLogRows(rows);
      break;
    }
    case Release.Fever: {
      const rows = await feverModels.surveyNonPii.findAll({
        where: {
          [Op.and]: [
            { survey: { isDemo: false } },
            { createdAt: { [Op.gte]: argv.start } },
            { createdAt: { [Op.lte]: argv.end } },
          ],
        },
      });
      consoleLogRows(rows);
      break;
    }
    default:
      throw failRelease(argv.release);
  }
}

interface BySamplesArgs {
  release: Release;
  types: string;
}

async function cmdBySamples(argv: BySamplesArgs): Promise<void> {
  const sample_types = argSplit(argv.types);

  switch (argv.release) {
    case Release.Fever: {
      const rows = await feverModels.surveyNonPii.findAll({
        where: {
          [Op.and]: [
            { survey: { isDemo: false } },
            ...sample_types.map(sample_type => ({
              "survey.samples::jsonb": {
                [Op.contains]: cast(JSON.stringify([{ sample_type }]), "JSONB"),
              },
            })),
          ],
        },
      });
      rows.forEach(row => console.log(pubId(row.csruid)));
      break;
    }
    case Release.Sniffles:
      throw fail("Sniffles support not yet implemented");
    default:
      throw failRelease(argv.release);
  }
}

interface HasCsruid {
  csruid: string;
}

function consoleLogRows(rows: HasCsruid[]): void {
  rows.forEach(x => console.log(x.csruid.substring(0, 21)));
}

async function feverSurveys(
  kind: string,
  q: any
): Promise<SomeSurveyInstance[]> {
  return await surveyModel(kind).findAll({
    where: {
      ...q,
      survey: {
        isDemo: false,
        ...q.survey,
      },
    },
  });
}

async function snifflesVisits(
  kind: string,
  q: any
): Promise<SomeVisitInstance[]> {
  return await visitModel(kind).findAll({
    where: {
      ...q,
      visit: {
        isDemo: false,
        ...q.visit,
      },
    },
  });
}

interface ShowPathArgs {
  release: Release;
  kind: string;
  path: string;
  rows: string;
}

async function cmdShowPath(argv: ShowPathArgs): Promise<void> {
  const pathNodes = partPath(argv.path);
  const rowLikes = argRowLikes(argv.rows);

  switch (argv.release) {
    case Release.Sniffles: {
      const rows = await snifflesVisits(argv.kind, {
        csruid: { [Op.like]: { [Op.any]: rowLikes } },
      });
      console.log(JSON.stringify(rows.map(row => getPart(row, pathNodes))));
      break;
    }
    case Release.Fever: {
      const rows = await feverSurveys(argv.kind, {
        csruid: { [Op.like]: { [Op.any]: rowLikes } },
      });
      console.log(JSON.stringify(rows.map(row => getPart(row, pathNodes))));
      break;
    }
    default:
      throw failRelease(argv.release);
  }
}

interface PermissionArgs {
  userid: string;
  permission: string;
}

async function cmdGrantPermission(argv: PermissionArgs) {
  if (!isPermission(argv.permission)) {
    throw new Error("Invalid permission");
  }
  await auth.grantPermission(argv.userid, argv.permission);
}

function isPermission(p: string): p is Permission {
  return Object.values(Permission).includes(p as Permission);
}

async function cmdRevokePermission(argv: PermissionArgs) {
  await auth.revokePermission(argv.userid, argv.permission);
}

interface DocumentEventsArgs {
  csruid: string;
}

async function cmdDocumentEvents(argv: DocumentEventsArgs): Promise<void> {
  const csruid = argv.csruid.trim();
  const rows = await feverModels.surveyNonPii.findAll({ where: { csruid } });
  if (rows.length === 0) {
    throw fail(`Could not find any surveys with csruid '${csruid}'.`);
  }

  rows.forEach(row => {
    row.survey.events.forEach(ev => {
      console.log(`${ev.at}[${ev.kind}]: ${ev.refId}`);
    });
  });
}

interface LogArgs {
  release: string;
  since: Date;
  until: Date;
  device: string;
  text: string;
}

async function cmdLog(argv: LogArgs): Promise<void> {
  switch (argv.release) {
    case Release.Sniffles:
      await snifflesLog(argv);
      break;
    case Release.Fever:
      await feverLog(argv);
      break;
    default:
      throw failRelease(argv.release);
  }
}

async function snifflesLog(argv: LogArgs): Promise<void> {
  const rows = await snifflesModels.clientLogBatch.findAll({
    where: {
      [Op.and]: [
        { batch: { timestamp: { [Op.gt]: argv.since } } },
        { batch: { timestamp: { [Op.lt]: argv.until } } },
      ],
    },
    order: [literal("batch->>'timestamp' ASC")],
  });

  const emitter = new LogEmitter();
  const reDevice = new RegExp(argv.device);
  const reText = new RegExp(argv.text);

  rows.forEach(row => {
    if (
      reDevice.test(row.device.installation) ||
      reDevice.test(row.device.deviceName)
    ) {
      row.batch.records.forEach(record => {
        if (reText.test(record.text)) {
          emitter.emit(row.device, record);
        }
      });
    }
  });
}

async function feverLog(argv: LogArgs): Promise<void> {
  const rows = await feverModels.clientLogBatch.findAll({
    where: {
      analytics: {
        [Op.and]: [
          { timestamp: { [Op.gt]: argv.since } },
          { timestamp: { [Op.lt]: argv.until } },
        ],
      },
    },
    order: [literal("analytics->>'timestamp' ASC")],
  });

  const emitter = new LogEmitter();
  const reDevice = new RegExp(argv.device);
  const reText = new RegExp(argv.text);

  rows.forEach(row => {
    if (reDevice.test(row.device.installation)) {
      const logs = [...row.analytics.logs];
      const events = [...row.analytics.events];

      row.analytics.logs.forEach(record => {
        if (reText.test(record.text)) {
          emitter.emit(row.device, record);
        }
      });
      row.analytics.events.forEach(record => {
        emitter.emitEvent(record);
      });
      if (row.analytics.crash != null) {
        console.log(
          "==========================================================="
        );
        console.log(row.analytics.crash);
        console.log(
          "==========================================================="
        );
      }
    }
  });
}

class LogEmitter {
  private previousDevice: string = "";

  emit(device: SomeDevice, record: LogRecordInfo): void {
    this.maybeEmitDevice(device);
    this.emitRecord(record);
  }

  maybeEmitDevice(device: SomeDevice): void {
    if (device.installation !== this.previousDevice) {
      const name = (<any>device).deviceName || "";
      console.log(
        `========== Device: ${name} (${device.installation}) ==========`
      );
      this.previousDevice = device.installation;
    }
  }

  emitRecord(record: LogRecordInfo): void {
    const level = (<any>record.level.toString()).padStart(5, " ");
    const text = record.text.replace(/\n/g, "\\n");
    console.log(`${record.timestamp} [${level}]: ${text}`);
  }

  emitEvent(event: EventInfo): void {
    const { kind, at, refId } = event;
    console.log(`${at} [event ${kind}]: ${refId}`);
  }
}

interface DemoArgs {
  release: Release;
  row: string;
  value: boolean;
}

async function cmdDemo(argv: DemoArgs): Promise<void> {
  const isDemo = argv.value == null ? true : !!argv.value;

  switch (argv.release) {
    case Release.Sniffles: {
      const dataNP = await sniffles.nonPii.load(argv.row.trim());
      const { csruid } = dataNP;
      const dataP = await sniffles.pii.load(csruid);
      await Promise.all([
        sniffles.nonPii.setDemo(dataNP, isDemo),
        sniffles.pii.setDemo(dataP, isDemo),
      ]);
      break;
    }

    case Release.Fever: {
      const dataNP = await fever.nonPii.load(argv.row.trim());
      const { csruid } = dataNP;
      const dataP = await fever.pii.load(csruid);
      await Promise.all([
        fever.nonPii.setDemo(dataNP, isDemo),
        fever.pii.setDemo(dataP, isDemo),
      ]);
      break;
    }

    default:
      throw new Error(`Unrecognized release: '${argv.release}`);
  }
}

interface Demo1Args {
  release: Release;
  kind: string;
  row: string;
  value: boolean;
}

async function cmdDemo1(argv: Demo1Args): Promise<void> {
  const isDemo = argv.value == null ? true : !!argv.value;

  switch (argv.release) {
    case Release.Sniffles:
      switch (argv.kind) {
        case "pii": {
          const data = await sniffles.pii.load(argv.row.trim());
          await sniffles.pii.setDemo(data, isDemo);
          break;
        }
        case "nonpii": {
          const data = await sniffles.nonPii.load(argv.row.trim());
          await sniffles.nonPii.setDemo(data, isDemo);
          break;
        }
        default:
          throw failKind(argv.kind);
      }
      break;

    case Release.Fever:
      switch (argv.kind) {
        case "pii": {
          const data = await fever.pii.load(argv.row.trim());
          await fever.pii.setDemo(data, isDemo);
          break;
        }
        case "nonpii": {
          const data = await fever.nonPii.load(argv.row.trim());
          await fever.nonPii.setDemo(data, isDemo);
          break;
        }
        default:
          throw failKind(argv.kind);
      }
      break;

    default:
      throw new Error(`Unrecognized release: '${argv.release}`);
  }
}

interface AdministratorArgs {
  row: string;
  value: string;
}

async function cmdSetSnifflesAdministrator(argv: AdministratorArgs) {
  const nonPii = await sniffles.nonPii.load(argv.row.trim());
  const pii = await sniffles.pii.load(nonPii.csruid);

  console.log(`Updating ${nonPii.csruid.substring(0, 21)} that has events:`);
  console.log(`${JSON.stringify(nonPii.visit.events, null, 2)}`);
  if (nonPii.visit.administrator === pii.visit.administrator) {
    console.log(`Current administrator: '${nonPii.visit.administrator}'`);
  } else {
    console.log(
      `Current non-pii administrator: '${nonPii.visit.administrator}'`
    );
    console.log(`Current pii administrator: '${pii.visit.administrator}'`);
    await expectYes(`Update both administrators to '${argv.value}'? `);
  }

  const updates = await Promise.all([
    sniffles.nonPii.updateItem(nonPii, {
      ...nonPii.visit,
      administrator: argv.value,
    }),
    sniffles.pii.updateItem(pii, { ...pii.visit, administrator: argv.value }),
  ]);
  if (updates.some(x => x)) {
    console.log(`Updated administrator to '${argv.value}'`);
  } else {
    console.log("Nothing changed");
  }
}

interface LocationArgs {
  row: string;
  value: string;
}

async function cmdSetSnifflesLocation(argv: LocationArgs) {
  if (!snifflesLocations[argv.value]) {
    console.log(
      `Unexpected location value '${argv.value}'.  Known locations are:`
    );
    Object.keys(snifflesLocations)
      .sort()
      .forEach(x => console.log(`  ${x}`));
    await expectYes(`Update anyway? `);
  }

  const nonPii = await sniffles.nonPii.load(argv.row.trim());
  const pii = await sniffles.pii.load(nonPii.csruid);

  console.log(`Updating ${nonPii.csruid.substring(0, 21)} that has events:`);
  console.log(`${JSON.stringify(nonPii.visit.events, null, 2)}`);
  if (nonPii.visit.location === pii.visit.location) {
    console.log(`Current location: '${nonPii.visit.location}'`);
  } else {
    console.log(`Current non-pii location: '${nonPii.visit.location}'`);
    console.log(`Current pii location: '${pii.visit.location}'`);
    await expectYes(`Update both locations to '${argv.value}'? `);
  }

  const updates = await Promise.all([
    sniffles.nonPii.updateItem(nonPii, {
      ...nonPii.visit,
      location: argv.value,
    }),
    sniffles.pii.updateItem(pii, { ...pii.visit, location: argv.value }),
  ]);
  if (updates.some(x => x)) {
    console.log(`Updated location to '${argv.value}'`);
  } else {
    console.log("Nothing changed");
  }
}

interface UploadArgs {
  release: Release;
  row: string;
}

async function cmdUpload(argv: UploadArgs): Promise<void> {
  const updater = nonPiiUpdater(argv.release);
  const nonPii = await updater.load(argv.row.trim());
  const csruid = nonPii.csruid;
  if (await updater.deleteUploadMarker(csruid)) {
    console.log(`Unmarked ${pubId(csruid)} (${argv.release}) as uploaded.`);
  } else {
    console.log(
      `Nothing changed: ${pubId(csruid)} (${argv.release}) is already unmarked.`
    );
  }
}

interface GenerateRandomKeyArgs {
  size?: number;
}
async function cmdGenerateRandomKey(
  argv: GenerateRandomKeyArgs
): Promise<void> {
  console.log(await generateRandomKey(argv.size));
}

interface AddAccessKeyArgs {
  release: Release;
  key: string;
}
async function cmdAddAccessKey(argv: AddAccessKeyArgs): Promise<void> {
  await accessKey(argv.release).create({
    key: argv.key,
    valid: true,
  });
  console.log(`Added access key '${argv.key}' and marked valid.`);
}

interface CreateAccessKeyArgs {
  release: Release;
}
async function cmdCreateAccessKey(argv: CreateAccessKeyArgs): Promise<void> {
  const components = [
    "X12ct9Go-AqgxyjnuCT4uOHFFokVfnB03BXo3vxw_TEQVBAaK53Kkk74mEwU5Nuw",
    await generateRandomKey(),
    await generateRandomKey(),
  ];
  const buffers = components.map(base64url.toBuffer);
  const buffer = buffers.reduce(bufferXor, Buffer.alloc(0));
  const key = base64url(buffer);

  await accessKey(argv.release).create({ key, valid: true });

  console.log(`New access key created and added for ${argv.release}`);
  console.log();
  console.log("Copy the following lines to your .env file:");
  console.log(`ACCESS_KEY_A='${components[1]}'`);
  console.log(`ACCESS_KEY_B='${components[2]}'`);
  console.log();
}

interface ShowAccessKeyArgs {
  release: Release;
  part: string;
}

async function cmdShowAccessKey(argv: ShowAccessKeyArgs): Promise<void> {
  const components = [
    "X12ct9Go-AqgxyjnuCT4uOHFFokVfnB03BXo3vxw_TEQVBAaK53Kkk74mEwU5Nuw",
    getKeyA(argv.release),
    argv.part,
  ];
  const buffers = components.map(base64url.toBuffer);
  const buffer = buffers.reduce(bufferXor, Buffer.alloc(0));
  const key = base64url(buffer);

  console.log(key);
}

function getKeyA(release: Release): string {
  switch (release) {
    case Release.Sniffles:
      return "TQpJzepFiEQoVTXAxFbORoMy3i23Xeeq_OYTM9esKzEFkpso0ZlQd5Hd_OWa9plB";
    case Release.Fever:
      return "7rebwsthpz5A9Xk8-h6lMd9a8hurQ2GuwQnkpYynzWfKJKogO8gHbQBS86Gjsk-F";
    case Release.Cough:
      return "7rebwsthpz5A9Xk8-h6lMd9a8hurQ2GuwQnkpYynzWfKJKogO8gHbQBS86Gjsk-F";
    case Release.Chills:
      return "7rebwsthpz5A9Xk8-h6lMd9a8hurQ2GuwQnkpYynzWfKJKogO8gHbQBS86Gjsk-F";
    default:
      throw failRelease(release);
  }
}

interface RecoverVisitArgs {
  barcode: string;
}

async function cmdRecoverVisit(argv: RecoverVisitArgs): Promise<void> {
  const id = `barcode=${argv.barcode}`;
  const data = await downloadRecoveredVisit(argv.barcode);
  await saveRecoveredVisit(id, data);
}

async function downloadRecoveredVisit(
  barcode: string
): Promise<VisitRecoveryData> {
  console.log(`Downloading recovery data for barcode=${barcode}.`);
  const app = await makeRecoveryFirebase();
  const db = app.firestore();
  const collection = db.collection("barcodes");
  const ref = collection.doc(barcode);
  const snapshot = await asyncFailIfError(
    () => ref.get(),
    `Could not get snapshot for ${barcode}`
  );
  if (snapshot == null) {
    throw fail(`Snapshot for ${barcode} is null`);
  }
  if (!snapshot.exists) {
    throw fail(`Snapshot for ${barcode} does not exist`);
  }
  return snapshot.data() as VisitRecoveryData;
}

async function saveRecoveredVisit(
  id: string,
  data: VisitRecoveryData
): Promise<void> {
  const decrypted = await decryptRecoveredVisit(
    `barcode=${data.barcode}`,
    data.encrypted_visit_info
  );
  const visit = JSON.parse(decrypted);
  const csruid = data.uid;
  const device = await dbcliSnifflesDevice(data, id);
  const visitNonPII = extractVisitNonPii(visit);
  const visitPII = extractVisitPii(visit);

  await Promise.all([
    snifflesModels.visitNonPii.create({ csruid, device, visit: visitNonPII }),
    snifflesModels.visitPii.create({ csruid, device, visit: visitPII }),
  ]);

  console.log(`Saved recovered record ${id}`);
  console.log(`  csruid: '${csruid}'`);
  console.log(`  nonpii: '${nonPiiDatabaseUrl()}'`);
  console.log(`     pii: '${piiDatabaseUrl()}'`);
  console.log(JSON.stringify(device, null, 2));
}

async function decryptRecoveredVisit(
  id: string,
  encrypted: string
): Promise<string> {
  const keyfile = getenv("SNIFFLES_RECOVERY_KEYFILE");
  const privateKey = await readFile(keyfile, UTF8);

  console.log(`Decrypting '${encrypted.substring(0, 80)}...'`);
  const decrypted = hybridCrypto.decrypt(privateKey, encrypted);
  if (decrypted == null || decrypted.message == null) {
    throw fail(`Decryption failed for '${id}'`);
  }

  return decrypted.message;
}

async function dbcliSnifflesDevice(
  data: VisitRecoveryData,
  id: string
): Promise<SnifflesDevice> {
  return {
    installation: data.installation_id,
    clientVersion: data.client_version,
    deviceName: data.device_name,
    yearClass: new Date().getFullYear().toString(),
    idiomText: `dbcli-recover-visit-${id}`,
    platform: JSON.stringify({
      nodejs: os.platform(),
    }),
  };
}

interface VisitRecoveryData {
  barcode: string;
  client_version: SnifflesClientVersionInfo;
  device_local_time: string;
  device_name: string;
  encrypted_visit_info: string;
  installation_id: string;
  uid: string;
}

interface ShowArgs {
  release: Release;
  kind: string;
  row: string;
}

async function cmdShow(argv: ShowArgs): Promise<void> {
  const upd = updater(argv.release, argv.kind);
  const data = await upd.load(argv.row.trim());
  console.log(JSON.stringify(data));
}

interface EditArgs {
  release: Release;
  kind: string;
  row: string;
  path: string;
}

async function cmdEdit(argv: EditArgs): Promise<void> {
  switch (argv.release) {
    case Release.Sniffles:
      switch (argv.kind) {
        case "pii":
          await snifflesEditPii(argv.row.trim(), argv.path);
          break;
        case "nonpii":
          await snifflesEditNonPii(argv.row.trim(), argv.path);
          break;
        default:
          throw failKind(argv.kind);
      }
      break;
    case Release.Fever:
      switch (argv.kind) {
        case "pii":
          await feverEditPii(argv.row.trim(), argv.path);
          break;
        case "nonpii":
          await feverEditNonPii(argv.row.trim(), argv.path);
          break;
        default:
          throw failKind(argv.kind);
      }
      break;
    default:
      throw failRelease(argv.release);
  }
  console.log("Committed changes.");
}

async function snifflesEditNonPii(row: string, path: string): Promise<void> {
  const original = await sniffles.nonPii.load(row);
  const merged = await snifflesEditVisitPart(original, path);
  await sniffles.nonPii.updateItem(original, merged);
}

async function snifflesEditPii(row: string, path: string): Promise<void> {
  const original = await sniffles.pii.load(row);
  const merged = await snifflesEditVisitPart(original, path);
  await sniffles.pii.updateItem(original, merged);
}

async function snifflesEditVisitPart(original: any, path: string) {
  const pathNodes = partPath(path);
  const part = getPart(original.visit, pathNodes);
  const edited = await editJson(part);

  const uid = original.csruid.substring(0, 21);
  console.log(`Preparing to update id=${original.id} csruid=${uid}..`);
  await colordiff(part, edited);
  console.log("Do you want to write these changes to the database?");
  await expectYes("Anything besides 'yes' will cancel. Choose wisely: ");

  return setPart(original.visit, pathNodes, edited);
}

async function feverEditNonPii(row: string, path: string): Promise<void> {
  const original = await fever.nonPii.load(row);
  const merged = await feverEditVisitPart(original, path);
  await fever.nonPii.updateItem(original, merged);
}

async function feverEditPii(row: string, path: string): Promise<void> {
  const original = await fever.pii.load(row);
  const merged = await feverEditVisitPart(original, path);
  await fever.pii.updateItem(original, merged);
}

async function feverEditVisitPart(original: any, path: string) {
  const pathNodes = partPath(path);
  const part = getPart(original.survey, pathNodes);
  const edited = await editJson(part);

  const uid = original.csruid.substring(0, 21);
  console.log(`Preparing to update id=${original.id} csruid=${uid}..`);
  await colordiff(part, edited);
  console.log("Do you want to write these changes to the database?");
  await expectYes("Anything besides 'yes' will cancel. Choose wisely: ");

  return setPart(original.survey, pathNodes, edited);
}

async function editJson(originalValue: any): Promise<any> {
  const cleanups = [];

  try {
    const tmp = await mkdtemp(pjoin(tmpdir(), `db-json-edit-`));
    cleanups.push(() => rmdir(tmp));

    const editPath = pjoin(tmp, "edit.json");
    console.log(`Temporary file: '${editPath}'`);
    const originalJson = JSON.stringify(originalValue, null, 2);

    await writeFile(editPath, originalJson, UTF8);
    cleanups.push(() => unlink(editPath));

    const editor = process.env.EDITOR || process.env.VISUAL || "vim";
    await run(editor, editPath);

    const editedJson = await readFile(editPath, UTF8);
    const editedValue = JSON.parse(editedJson);

    if (_.isEqual(originalValue, editedValue)) {
      throw fail("canceling because no changes detected.");
    }

    return editedValue;
  } finally {
    await cleanups.reduceRight((acc, p) => acc.then(p), Promise.resolve());
  }
}

async function expectYes(query: string): Promise<void> {
  const answer = await question(query);
  if (answer !== "yes") {
    throw fail(`canceling because '${answer}' is not 'yes'`);
  }
}

async function question(query: string): Promise<string> {
  const rl = createReadline({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise<string>(resolve => {
    rl.question(query, answer => {
      rl.close();
      resolve(answer);
    });
  });
}

async function colordiff(before: any, after: any): Promise<void> {
  const cleanups = [];
  try {
    const tmp = await mkdtemp(pjoin(tmpdir(), `json-diff-`));
    cleanups.push(() => rmdir(tmp));

    const beforePath = pjoin(tmp, "before.json");
    const afterPath = pjoin(tmp, "after.json");

    await writeFile(beforePath, JSON.stringify(before, null, 2) + "\n", UTF8);
    cleanups.push(() => unlink(beforePath));

    await writeFile(afterPath, JSON.stringify(after, null, 2) + "\n", UTF8);
    cleanups.push(() => unlink(afterPath));

    const code = await runCode(
      "colordiff",
      "--unified=3",
      beforePath,
      afterPath
    );
    if ([0, 1].indexOf(code) < 0) {
      throw fail(`'colordiff' exited with code '${code}', expected 0 or 1`);
    }
  } finally {
    await cleanups.reduceRight((acc, p) => acc.then(p), Promise.resolve());
  }
}

// Run a command and throw if it does not exit successfully.
async function run(program: string, ...args: string[]): Promise<void> {
  const code = await runCode(program, ...args);
  if (code != 0) {
    throw fail(`'${program}' exited with code '${code}'`);
  }
}

// Run a command and returns the exit code.  Naming is hard.
// NOTE this does not throw if the command fails.
function runCode(program: string, ...args: string[]): Promise<number> {
  return new Promise<number>((resolve, reject) => {
    const proc = spawn(program, args, {
      stdio: "inherit",
      shell: true,
    });
    proc.on("close", code => {
      resolve(code);
    });
  });
}

function accessKey(release: Release) {
  return forApp(release, {
    sniffles: () => snifflesModels.accessKey,
    fever: () => feverModels.accessKey,
    cough: () => coughModels.accessKey,
    chills: () => chillsModels.accessKey,
  });
}

function surveyModel(kind: string): SomeSurveyModel {
  switch (kind) {
    case "pii":
      return feverModels.surveyPii;
    case "nonpii":
      return feverModels.surveyNonPii;
    default:
      throw failKind(kind);
  }
}

function visitModel(kind: string): SomeVisitModel {
  switch (kind) {
    case "pii":
      return snifflesModels.visitPii;
    case "nonpii":
      return snifflesModels.visitNonPii;
    default:
      throw failKind(kind);
  }
}

function updater(release: Release, kind: string): SomeUpdater {
  switch (kind) {
    case "pii":
      return piiUpdater(release);
    case "nonpii":
      return nonPiiUpdater(release);
    default:
      throw failKind(kind);
  }
}

function piiUpdater(release: Release) {
  return forApp<SnifflesPiiUpdater | FeverPiiUpdater>(release, {
    sniffles: () => sniffles.pii,
    fever: () => fever.pii,
    cough: () => {
      throw failRelease(release);
    },
    chills: () => {
      throw failRelease(release);
    },
  });
}

function nonPiiUpdater(release: Release) {
  return forApp<SnifflesNonPiiUpdater | FeverNonPiiUpdater>(release, {
    sniffles: () => sniffles.nonPii,
    fever: () => fever.nonPii,
    cough: () => {
      throw failRelease(release);
    },
    chills: () => {
      throw failRelease(release);
    },
  });
}

function forApp<T>(release: Release, choices: { [key in Release]: () => T }) {
  const choice = choices[release];
  if (choice == null) {
    throw failRelease(release);
  }

  return choice();
}

async function makeRecoveryFirebase(): Promise<App> {
  const credentialFile = getenv("FIREBASE_RECOVERY_CREDENTIALS");
  const credentials = await readFile(credentialFile, { encoding: "utf8" });
  return firebase.initializeApp({
    credential: firebase.credential.cert(JSON.parse(credentials)),
  });
}

function getenv(key: string): string {
  const value = process.env[key];
  if (value == null) {
    throw fail(`Expected environment variable '${key}' to be set.`);
  }
  return value;
}

function pubId(csruid: string): string {
  return csruid.substring(0, 21);
}

function argRowLikes(rows: string): string[] {
  return argSplit(rows).map(x => `${x}%`);
}

function argSplit(arg: string): string[] {
  return arg.split(/[\s,]/).filter(x => x !== "");
}

function expectOne<T>(items: T[]): T {
  if (items.length == 1) {
    return items[0];
  } else {
    throw fail(`Expected exactly one item, but got ${items.length}`);
  }
}

async function asyncFailIfError<T>(
  call: () => Promise<T>,
  message: string
): Promise<T> {
  try {
    return await call();
  } catch (err) {
    throw fail(`${message}\n${err}`);
  }
}

function failKind(kind: string): never {
  throw fail(`expected kind to be either 'pii' or 'nonpii', got '${kind}'`);
}

function failRelease(release: string | Release): never {
  if (release === "cough") {
    throw fail("This command is not yet implemented for cough");
  }
  throw fail(
    `Unrecognized release: '${release}', ` +
      `expected one of '${Object.keys(Release).join("', '")}'`
  );
}

function fail(message: string): never {
  const error = new Error(message);
  (<any>error).checked = true;
  throw error;
}

interface AddDemoCoughGiftcardsArgs {
  count: number;
  denomination: number;
}

async function cmdAddDemoCoughGiftcards(argv: AddDemoCoughGiftcardsArgs) {
  await addDemoGiftcards(coughModels, argv.count, argv.denomination);
}
