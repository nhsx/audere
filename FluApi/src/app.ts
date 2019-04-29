// Copyright (c) 2018, 2019 by Audere
//
// Use of this source code is governed by an MIT-style license that
// can be found in the LICENSE file distributed with this file.

import bodyParser from "body-parser";
import base64url from "base64url";
import morgan from "morgan";
import { SnifflesEndpoint } from "./endpoints/snifflesApi";
import { ConsentEmailerEndpoint } from "./endpoints/snifflesConsentMailer";
import { HutchUploaderEndpoint } from "./endpoints/hutchUpload";
import { FeverEndpoint } from "./endpoints/feverApi";
import { generateRandomKey, generateRandomBytes } from "./util/crypto";
import { SplitSql } from "./util/sql";
import { FeverCronReportEndpoint } from "./endpoints/feverCronReport";
import { FeverConsentEmailerEndpoint } from "./endpoints/feverConsentMailer";
import { FeverValidateAddress } from "./endpoints/feverValidateAddress";
import { BarcodeValidator } from "./endpoints/barcodeValidator";
import { useOuch, createApp, wrap, requestId } from "./util/expressApp";
import { PortalConfig, portalApp } from "./endpoints/webPortal/endpoint";
import { isAWS } from "./util/environment";
import * as routeStats from "express-hot-shots";
import logger from "./util/logger";
import { DeviceSettingsEndpoint } from "./endpoints/deviceSettings";

const buildInfo = require("../static/buildInfo.json");

export interface AppConfig extends PortalConfig {
  sql: SplitSql;
  consentEmailer?: FeverConsentEmailerEndpoint;
}

export async function createPublicApp(config: AppConfig) {
  function stats(path: string) {
    return function(req, res, next) {
      const method = req.method || "unknown_method";
      req.statsdKey = ["public", method.toLowerCase(), path].join(".");
      next();
    };
  }

  const sql = config.sql;

  // Public app is internet-facing.
  const publicApp = createApp();

  if (isAWS()) {
    publicApp.use(routeStats.default());
  }

  publicApp.set("port", process.env.PORT || 3000);
  publicApp.use(bodyParser.json({ limit: "20mb" }));
  publicApp.use(morganMiddleware());

  publicApp.use("/portal", stats("portal"), await portalApp(config));

  publicApp.get("/api", stats("api"), (req, res) => res.json({ Status: "OK" }));

  const sniffles = new SnifflesEndpoint(sql);
  publicApp.put(
    "/api/documents/:key([A-Za-z0-9-_]{0,})/:documentId([A-Za-z0-9-_]{0,})",
    stats("docwithkey"),
    (req, res, next) => sniffles.putDocumentWithKey(req, res, next)
  );

  const fever = new FeverEndpoint(sql);
  publicApp.put(
    "/api/fever/documents/:key([A-Za-z0-9-_]{0,})/:documentId([A-Za-z0-9-_]{0,})",
    stats("feverdoc"),
    (req, res, next) => fever.putFeverDocument(req, res, next)
  );

  publicApp.get(
    "/api/documentId",
    stats("getdoc"),
    wrap(async (req, res) => {
      res.json({ id: await generateRandomKey() });
    })
  );

  publicApp.get(
    "/api/randomBytes/:numBytes",
    stats("random"),
    wrap(async (req, res) => {
      res.json({
        bytes: base64url(
          await generateRandomBytes(parseInt(req.params.numBytes))
        )
      });
    })
  );

  publicApp.get("/about", stats("about"), (req, res) => {
    res.status(200).send(buildInfo);
  });

  const barcodeValidator = new BarcodeValidator(sql);
  publicApp.get(
    "/api/validateBarcode/:barcode([0-9a-f]{8})",
    stats("validateBarcode"),
    wrap(async (req, res) => {
      return barcodeValidator.validate(req, res);
    })
  );

  const deviceSettings = new DeviceSettingsEndpoint(sql);
  publicApp.get(
    "/api/settings/:device([A-Z0-9-]+)/:key([a-zA-Z0-9-_]+)",
    wrap(async (req, res) => {
      return deviceSettings.getSetting(req, res);
    })
  );

  const feverAddress = new FeverValidateAddress(sql);

  // Remove once all clients are updated to use /api/validateUniqueAddress
  publicApp.get(
    "/api/validateAddress",
    stats("validateaddress"),
    wrap(async (req, res) => {
      const results = await feverAddress.validate(req.query);
      res.json(results);
    })
  );

  publicApp.get(
    "/api/validateUniqueAddress",
    stats("validateaddress"),
    wrap(async (req, res) => {
      const results = await feverAddress.validateAndCheckDuplicates(
        JSON.parse(req.query.address),
        req.query.csruid
      );
      res.json(results);
    })
  );

  publicApp.get(
    "/api/utility/echoStatus/:code([0-9]+)",
    wrap(async (req, res) => {
      const code = +req.params.code;
      res.sendStatus((code >= 100 && code <= 599) ? code : 404);
    })
  );
  return useOuch(publicApp);
}

export function createInternalApp(config: AppConfig) {
  function stats(path: string) {
    return function(req, res, next) {
      const method = req.method || "unknown_method";
      req.statsdKey = ["internal", method.toLowerCase(), path].join(".");
      next();
    };
  }

  const sql = config.sql;

  // Internal app should be intranet only.
  const internalApp = createApp();

  if (isAWS()) {
    internalApp.use(routeStats.default());
  }

  internalApp.set("port", process.env.INTERNAL_PORT || 3200);
  internalApp.use(bodyParser.json());
  internalApp.use(morganMiddleware());

  internalApp.get("/api", stats("api"), (req, res) =>
    res.json({ Status: "OK" })
  );

  const hutchUploader = new HutchUploaderEndpoint(sql);
  const snifflesConsentEmailer = new ConsentEmailerEndpoint(sql);
  internalApp.get(
    "/api/export/getEncounters",
    stats("getencounters"),
    (req, res, next) => hutchUploader.getEncounters(req, res, next)
  );

  internalApp.get(
    "/api/export/sendEncounters",
    stats("sendencounters"),
    (req, res, next) => hutchUploader.sendEncounters(req, res, next)
  );

  const fever = new FeverCronReportEndpoint(sql);
  internalApp.get(
    "/api/export/sendIncentives",
    stats("sendincentives"),
    (req, res, next) => fever.sendIncentives(req, res, next)
  );

  internalApp.get(
    "/api/export/sendKitOrders",
    stats("sendkitorders"),
    (req, res, next) => fever.sendKitOrders(req, res, next)
  );

  internalApp.get(
    "/api/export/sendFollowUps",
    stats("sendfollowups"),
    (req, res, next) => fever.sendSurveys(req, res, next)
  );

  internalApp.get(
    "/api/export/provisionBarcodes",
    stats("provisionbarcodes"),
    (req, res, next) => fever.exportBarcodes(req, res, next)
  );

  internalApp.get(
    "/api/import/receivedKits",
    stats("importreceivedkits"),
    (req, res, next) => fever.importReceivedKits(req, res, next)
  );

  const feverConsentEmailer =
    config.consentEmailer || new FeverConsentEmailerEndpoint(sql);
  // TODO: remove after migrating lambda to sendFeverConsentEmails
  internalApp.get(
    "/api/sendConsentEmails",
    stats("sendconsents"),
    feverConsentEmailer.handleGet
  );
  internalApp.get(
    "/api/sendFeverConsentEmails",
    stats("sendfeverconsents"),
    feverConsentEmailer.handleGet
  );

  internalApp.get(
    "/api/sendSnifflesConsentEmails",
    stats("sendSnifflesConsents"),
    snifflesConsentEmailer.sendConsentEmails
  );

  return useOuch(internalApp);
}

const MORGAN_FORMAT =
  ":request-id :req[X-Forwarded-For](:remote-addr) :userid :method :status :url :req[content-length] :res[content-length] :response-time @morgan";

const MORGAN_STREAM = {
  write: message => logger.info(message)
};

morgan.token("request-id", (req: any, res) => requestId(req));
morgan.token("userid", (req: any, res) => req.user ? req.user.userid : "-");

function morganMiddleware() {
  return morgan(MORGAN_FORMAT, {
    stream: MORGAN_STREAM
  });
}
