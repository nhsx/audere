// Copyright (c) 2019 by Audere
//
// Use of this source code is governed by an LGPL-3.0 license that
// can be found in the LICENSE file distributed with this file.

import wd from "wd";
import strings from "../../src/i18n/locales/en.json";
import { content } from "./fluathomeContent.js";
import { createSplitSql } from "../../../FluApi/src/util/sql";
import { defineCoughModels } from "../../../FluApi/src/models/db/cough";
import { Op } from "sequelize";
import axios from "axios";
import {
  multi_tap,
  scroll_to_element,
  get_element_location,
  full_scroll,
  half_scroll,
} from "./util/navigation";
import {
  android_buttonGrid,
  ios_buttonGrid,
  android_select,
  ios_select,
  text_entry,
  choose_checkboxes,
  choose_radio,
} from "./util/controls";
import { app_setup_for_automation, display_rdt_stats } from "./util/tools";

console.log(
  "Using test file",
  process.env.TEST_UI_INPUT ? process.env.TEST_UI_INPUT : "default.js"
);
const { inputs } = process.env.TEST_UI_INPUT
  ? require(process.env.TEST_UI_INPUT)
  : require("./testInputs/default.js");
const deviceInfo = require(process.env.TEST_UI_CONFIG);
const platform = deviceInfo.PLATFORM;
const screen_x = deviceInfo.SCREEN_X;
const screen_y = deviceInfo.SCREEN_Y;
const isSimulator = deviceInfo.SIMULATOR;
const fs = require("fs");

jasmine.DEFAULT_TIMEOUT_INTERVAL = 10000000;
const PORT = 4723;
const driver = wd.promiseChainRemote("localhost", PORT);

//Drive through app always picking chocies specified in input file
describe("Happy Path", () => {
  let sql;
  let models;

  beforeAll(async done => {
    sql = createSplitSql();
    models = defineCoughModels(sql);
    done();
  });

  afterAll(async done => {
    await sql.close();
    done();
  });

  beforeEach(async () => {
    await driver.init(deviceInfo.config);
    await driver.setImplicitWaitTimeout(600000);
  });

  afterEach(async () => {
    await driver.quit();
  });

  test("A user should be able to navigate through the entire app", async () => {
    await runThroughApp(models, true);
  });

  test("Non-demo mode test", async () => {
    await runThroughApp(models, false);
  });

  test("Run through app 20 times", async () => {
    for (let ii = 0; ii < 20; ii++) {
      await runThroughApp(models, true);
      await multi_tap(driver, deviceInfo, screen_x * 0.5, screen_y * 0.07, 4);
    }
  });
});

//goes through entire app
async function runThroughApp(models, isDemo) {
  expect(await driver.hasElementByAccessibilityId(strings.Welcome.title)).toBe(
    true
  );
  await driver.setImplicitWaitTimeout(10000);
  await driver.sleep(1000); // let welcome animation finish
  const installationId = await app_setup_for_automation(
    driver,
    deviceInfo,
    isDemo
  );

  let files_to_write = {};
  let screen_num = 1;
  let screens_visited = ["Version"];

  // for (const screen_info of content) {
  screen_info = content.find(screen => screen.key === "Welcome");
  while (screen_info) {
    if (!isDemo) {
      await driver.sleep(1200); //let screen finish loading
      let screenshot = await driver.takeScreenshot();
      let filename =
        (screen_num < 10 ? "0" : "") +
        screen_num +
        "_" +
        screen_info.title.replace(/['!\?\.]/g, "").replace(/ /g, "_");
      files_to_write[filename] = screenshot;
      screen_num++;
    }
    if (screen_info.type == "basic") {
      next_screen = await basic_screen(driver, screen_info, screens_visited);
    } else if (screen_info.type == "input") {
      //skip question about number of lines if RDT capture was not successful
      if (
        screen_info.title != strings.PostRDTTestStripSurvey.title ||
        !screens_visited.includes("TestStripCamera")
      ) {
        next_screen = await input_screen(driver, screen_info, screens_visited);
      } else {
        next_screen = screen_info.button.onClick;
      }
    } else if (screen_info.type == "timer") {
      next_screen = await timer_screen(
        driver,
        screen_info,
        screens_visited,
        isDemo
      );
    } else if (screen_info.type == "barcode") {
      next_screen = await barcode_screen(driver, screen_info, screens_visited);
    } else if (screen_info.type == "consent") {
      next_screen = await consent_screen(driver, screen_info, screens_visited);
    } else if (screen_info.type == "blue_line_question") {
      next_screen = await blue_line_question_screen(
        driver,
        screen_info,
        screens_visited
      );
    } else if (screen_info.type == "rdt") {
      next_screen = await rdt_screen(
        driver,
        screen_info,
        models,
        installationId,
        screens_visited
      );
    }
    screen_info = next_screen
      ? content.find(screen => screen.key === next_screen)
      : null;
  }
  if (!isDemo) {
    printScreenshots(files_to_write);
  }
  await verify_db_contents(driver, models, installationId, screens_visited);
}

//check for screen title and click button for next page
async function basic_screen(driver, screen_info, screens_visited) {
  expect(await driver.hasElementByAccessibilityId(screen_info.title)).toBe(
    true
  );
  screens_visited.push(screen_info.key);

  if ("button" in screen_info) {
    await scroll_to_element(driver, deviceInfo, screen_info.button.name);
    await driver.elementByAccessibilityId(screen_info.button.name).click();

    if (
      "iosPopupOnContinue" in screen_info &&
      platform == "iOS" &&
      (await driver.hasElementByAccessibilityId(screen_info.iosPopupOnContinue))
    ) {
      await driver
        .elementByAccessibilityId(screen_info.iosPopupOnContinue)
        .click();
    }
    return screen_info.button.onClick;
  }
}

//Check for title, enter default choices for questions, click button for next screen
async function input_screen(driver, screen_info, screens_visited) {
  expect(await driver.hasElementByAccessibilityId(screen_info.title)).toBe(
    true
  );
  screens_visited.push(screen_info.key);

  for (let i = 0; i < screen_info.input.length; i++) {
    const question = screen_info.input[i];
    if (question.name in inputs) {
      let questionY = await scroll_to_element(
        driver,
        deviceInfo,
        question.name
      );
      if (questionY > screen_y * 0.6) {
        await half_scroll(driver, deviceInfo);
      }

      if (question.type == "text") {
        await text_entry(driver, deviceInfo, question, inputs);
      } else if (question.type == "checkbox" && question.name in inputs) {
        await choose_checkboxes(driver, deviceInfo, question, inputs);
      } else if (question.type == "radio" && question.name in inputs) {
        await choose_radio(driver, deviceInfo, question, inputs);
      } else if (question.type == "buttonGrid" && question.name in inputs) {
        const nextQuestion =
          i + 1 != screen_info.input.length ? screen_info.input[i + 1] : null;
        if (platform == "iOS") {
          await ios_buttonGrid(
            driver,
            question,
            nextQuestion,
            screen_info,
            inputs,
            deviceInfo
          );
        } else {
          await android_buttonGrid(
            driver,
            question,
            nextQuestion,
            screen_info,
            inputs,
            deviceInfo
          );
        }
      } else if (question.type == "select" && question.name in inputs) {
        if (platform == "iOS") {
          await ios_select(driver, question, inputs);
        } else {
          await android_select(driver, question, inputs, deviceInfo);
        }
      }
    }
  }

  await scroll_to_element(driver, deviceInfo, screen_info.button.name);
  await driver.elementByAccessibilityId(screen_info.button.name).click();
  return screen_info.button.onClick;
}

//Barcode screen logic: allows for invalid barcodes if desired
async function barcode_screen(driver, screen_info, screens_visited) {
  expect(await driver.hasElementByAccessibilityId(screen_info.title)).toBe(
    true
  );
  screens_visited.push(screen_info.key);

  let barcode_to_try = true;
  let num_bad_barcodes = 0;

  while (barcode_to_try) {
    let code;
    if (
      !screens_visited.includes("BarcodeContactSupport") &&
      "InvalidBarcodes" in inputs &&
      inputs["InvalidBarcodes"].length > num_bad_barcodes
    ) {
      code = inputs["InvalidBarcodes"][num_bad_barcodes];
      num_bad_barcodes++;
    } else {
      code = inputs[screen_info.input[0].placeholder];
      barcode_to_try = false;
    }
    await driver
      .elementByAccessibilityId(screen_info.input[0].placeholder)
      .type(code);
    await driver
      .elementByAccessibilityId(screen_info.input[1].placeholder)
      .type(code);

    if (await driver.isKeyboardShown()) {
      if (platform == "iOS") {
        await driver
          .elementByAccessibilityId(strings.common.button.done)
          .click();
      } else {
        await driver.hideDeviceKeyboard();
      }
    }
    await driver.elementByAccessibilityId(screen_info.button.name).click();
    if (num_bad_barcodes == 4) {
      return "BarcodeContactSupport";
    } else if (barcode_to_try && platform == "iOS") {
      await driver.elementByAccessibilityId(strings.common.button.ok).click();
    } else if (barcode_to_try && platform == "Android") {
      await driver.element("id", "android:id/button1").click();
    }
  }

  return screen_info.button.onClick;
}

//Consent screen logic: allows automation to consent or deny consent
async function consent_screen(driver, screen_info, screens_visited) {
  //skip looking for title if coming back from ConsentDeclined
  if (!screens_visited.includes("ConsentDeclined")) {
    expect(await driver.hasElementByAccessibilityId(screen_info.title)).toBe(
      true
    );
  }
  screens_visited.push(screen_info.key);

  let next_screen_key;
  if (
    "ConsentDeclined" in inputs &&
    !screens_visited.includes("ConsentDeclined")
  ) {
    await scroll_to_element(driver, deviceInfo, screen_info.denyButton.name);
    await driver.elementByAccessibilityId(screen_info.denyButton.name).click();
    next_screen_key = screen_info.denyButton.onClick;
  } else {
    let questionY = await scroll_to_element(
      driver,
      deviceInfo,
      screen_info.input[0].name
    );
    if (questionY > screen_y * 0.6) {
      await half_scroll(driver, deviceInfo);
    }
    platform == "iOS"
      ? await ios_buttonGrid(
          driver,
          screen_info.input[0],
          null,
          screen_info,
          inputs,
          deviceInfo
        )
      : await android_buttonGrid(
          driver,
          screen_info.input[0],
          null,
          screen_info,
          inputs,
          deviceInfo
        );
    await scroll_to_element(driver, deviceInfo, screen_info.button.name);
    await driver.elementByAccessibilityId(screen_info.button.name).click();
    next_screen_key = screen_info.button.onClick;
  }
  return next_screen_key;
}

//Test strip survey screen logic: allows automation to not see blue line
async function blue_line_question_screen(driver, screen_info, screens_visited) {
  expect(await driver.hasElementByAccessibilityId(screen_info.title)).toBe(
    true
  );
  screens_visited.push(screen_info.key);

  if (platform == "iOS") {
    await ios_buttonGrid(
      driver,
      screen_info.input[0],
      null,
      screen_info,
      inputs,
      deviceInfo
    );
  } else {
    await android_buttonGrid(
      driver,
      screen_info.input[0],
      null,
      screen_info,
      inputs,
      deviceInfo
    );
  }

  await driver.elementByAccessibilityId(screen_info.button.name).click();
  if (inputs[strings.surveyTitle.blueLine] == strings.surveyButton.yes) {
    return screen_info.button.onClick;
  } else {
    return "InvalidResult";
  }
}

//RDT screen logic: Answer camera permissions and click button to take a picture
async function rdt_screen(
  driver,
  screen_info,
  models,
  installationId,
  screens_visited
) {
  if (
    platform == "Android" &&
    (await driver.hasElement(
      "id",
      "com.android.packageinstaller:id/permission_allow_button"
    ))
  ) {
    await driver
      .element("id", "com.android.packageinstaller:id/permission_allow_button")
      .click();
  } else {
    if (
      await driver.hasElementByAccessibilityId(
        strings.common.button.ok.toUpperCase()
      )
    ) {
      await driver
        .elementByAccessibilityId(strings.common.button.ok.toUpperCase())
        .click();
    }
  }

  let manual_capture_required = true;
  if (!isSimulator) {
    screens_visited.push(screen_info.key);
    startTime = new Date();
    secondsElapsed = 0;
    console.log("RDT Capture attempted");
    while (manual_capture_required && secondsElapsed <= 45) {
      if (
        await driver.hasElementByAccessibilityId(
          strings.TestStripConfirmation.title
        )
      ) {
        manual_capture_required = false;
      }
      currentTime = new Date();
      secondsElapsed = (currentTime - startTime) / 1000;
    }
  }

  if (manual_capture_required) {
    console.log("RDT Capture FAILED");
    if (platform == "Android") {
      await driver.sleep(3000); //wait to make sure button can load
      await driver.element("id", "android:id/button1").click();
    } else {
      await driver.elementByAccessibilityId(strings.common.button.ok).click();
    }

    //prevents the tap from happening before the button appears
    await driver.sleep(2000);
    screens_visited.push("TestStripCamera");
    await new wd.TouchAction(driver)
      .tap({ x: screen_x * 0.5, y: screen_y * 0.95 })
      .perform();
    await driver.sleep(5000);
  } else {
    console.log("RDT Capture Succeeded!");
    display_rdt_stats(driver, models, installationId);
  }
  return "TestStripConfirmation";
}

//Timer screen logic: Answer push notifications question if necessary and bypass timer
async function timer_screen(driver, screen_info, screens_visited, isDemo) {
  expect(await driver.hasElementByAccessibilityId(screen_info.title)).toBe(
    true
  );
  screens_visited.push(screen_info.key);

  if (isDemo) {
    //tap until timer is bypassed
    await multi_tap(driver, deviceInfo, screen_x * 0.5, screen_y * 0.95, 3);
    while (
      !(await driver.hasElementByAccessibilityId(screen_info.button.name))
    ) {
      await multi_tap(driver, deviceInfo, screen_x * 0.5, screen_y * 0.95, 3);
      driver.sleep(1000);
    }
  } else {
    while (
      !(await driver.hasElementByAccessibilityId(screen_info.button.name))
    ) {
      driver.sleep(1000);
    }
  }
  await driver.elementByAccessibilityId(screen_info.button.name).click();
  return screen_info.button.onClick;
}

//Check that navigation events and question answers are correctly stored in the databse
async function verify_db_contents(
  driver,
  models,
  installationId,
  screens_visited
) {
  await driver.sleep(5000); // Let firestore sync
  const response = await axios.get(
    "http://localhost:3200/api/import/coughDocuments"
  );
  if (response.status !== 200) {
    throw new Error(`Expected 200, got ${response.status}`);
  }

  const dbRowsAndNum = await models.survey.findAndCountAll({
    where: {
      device: {
        installation: {
          [Op.eq]: installationId,
        },
      },
    },
    order: [["id", "ASC"]],
  });

  //gets most recent row with same installationId
  const dbRow = dbRowsAndNum["rows"][dbRowsAndNum["count"] - 1];

  //verify navigation events
  const expected = screens_visited;
  const actual = dbRow.survey.events.map(item => item.refId);
  expect(actual).toEqual(expected);

  //verify user responses
  const inputScreens = content.filter(item => "input" in item);
  inputScreens.forEach(screen => {
    const questions = screen.input.filter(
      question => "dbLocation" in question && question.name in inputs
    );
    questions.forEach(question => {
      if (
        [
          strings.surveyTitle.symptomsStart,
          strings.surveyTitle.symptomsLast48,
          strings.surveyTitle.symptomsSeverity,
        ].includes(question.name)
      ) {
        const symptoms = inputs[strings.surveyTitle.whatSymptoms];
        for (let i = 0; i < symptoms.length; i++) {
          const questionDb = dbRow.survey.responses[0].item.find(
            item => item.text === `${question.name} ${symptoms[i]}`
          );
          const answerDb =
            questionDb.answerOptions[questionDb.answer[0].valueIndex].text;
          const answerApp = Array.isArray(inputs[question.name])
            ? inputs[question.name][i]
            : inputs[question.name];
          expect(questionDb.answer).toHaveLength(1);
          expect(answerApp).toEqual(answerDb);
        }
      } else if (
        question.dbLocation === "responses" &&
        inputs[question.name] != strings.surveyButton.preferNotToSay &&
        (question.name != strings.surveyTitle.numLinesSeen ||
          !screens_visited.includes("TestStripCamera"))
      ) {
        const questionDb = dbRow.survey.responses[0].item.find(item =>
          item.text.startsWith(question.name)
        );
        if (Array.isArray(inputs[question.name])) {
          expect(questionDb.answer).toHaveLength(inputs[question.name].length);
          for (answer of questionDb.answer) {
            const answerDb = questionDb.answerOptions[answer.valueIndex].text;
            expect(inputs[question.name]).toContain(answerDb);
          }
        } else if (question.type === "text") {
          expect(inputs[question.name]).toEqual(
            questionDb.answer[0].valueString
          );
        } else {
          const answerDb =
            questionDb.answerOptions[questionDb.answer[0].valueIndex].text;
          expect(questionDb.answer).toHaveLength(1);
          expect(inputs[question.name]).toEqual(answerDb);
        }
      } else if (question.dbLocation === "samples") {
        expect(dbRow.survey.samples[0].code).toEqual(inputs[question.name]);
      }
    });
  });
}

async function printScreenshots(files_to_write) {
  const build = fs
    .readFileSync("./android/app/version.properties", "utf8")
    .split("=")[1]
    .trim();
  const targetDir = `./appScreenshots/Build${build}/${deviceInfo.config.deviceName}`;
  fs.mkdirSync(targetDir, { recursive: true });
  for (const f in files_to_write) {
    fs.writeFile(
      `${targetDir}/${f}.png`,
      files_to_write[f],
      { encoding: "base64" },
      function(err) {
        if (err) throw err;
      }
    );
  }
}
