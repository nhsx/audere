// Copyright (c) 2019 by Audere
//
// Use of this source code is governed by an MIT-style license that
// can be found in the LICENSE file distributed with this file.

import React, { Fragment } from "react";
import {
  Dimensions,
  Image,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { NavigationScreenProp } from "react-navigation";
import { connect } from "react-redux";
import { WithNamespaces, withNamespaces } from "react-i18next";
import { BarCodeScanner, Camera, Permissions } from "expo";
import Spinner from "react-native-loading-spinner-overlay";
import DeviceInfo from "react-native-device-info";
import { SampleInfo } from "audere-lib/feverProtocol";
import {
  Action,
  Option,
  StoreState,
  appendInvalidBarcode,
  setKitBarcode,
  setRDTPhoto,
  setTestStripImg,
  uploader,
} from "../../store";
import {
  WhenSymptomsScreenConfig,
  WhatSymptomsConfig,
  GeneralExposureScreenConfig,
  BlueLineConfig,
  RedWhenBlueConfig,
  TestStripSurveyConfig,
} from "../../resources/ScreenConfig";
import reduxWriter, { ReduxWriterProps } from "../../store/ReduxWriter";
import timerWithConfigProps, { TimerProps } from "../components/Timer";
import { newCSRUID } from "../../util/csruid";
import BarcodeEntry from "../components/flu/BarcodeEntry";
import BorderView from "../components/BorderView";
import Chrome from "../components/Chrome";
import Screen from "../components/Screen";
import Text from "../components/Text";
import TextInput from "../components/TextInput";
import {
  invalidBarcodeShapeAlert,
  validBarcodeShape,
  unverifiedBarcodeAlert,
} from "../../util/barcodeVerification";
import {
  ASPECT_RATIO,
  BORDER_RADIUS,
  BUTTON_WIDTH,
  ERROR_COLOR,
  GUTTER,
  KEYBOARD_BEHAVIOR,
  LARGE_TEXT,
  SECONDARY_COLOR,
  SYSTEM_PADDING_BOTTOM,
} from "../styles";
import { tracker, FunnelEvents } from "../../util/tracker";

const SECOND_MS = 1000;
const MINUTE_MS = 60 * SECOND_MS;
const TEST_STRIP_MS = 10 * MINUTE_MS;

interface Props {
  dispatch(action: Action): void;
  navigation: NavigationScreenProp<any, any>;
}

interface InvalidBarcodeProps {
  invalidBarcodes: SampleInfo[];
}

@connect((state: StoreState) => ({
  invalidBarcodes: state.survey.invalidBarcodes,
}))
class ScanScreen extends React.Component<
  Props & InvalidBarcodeProps & WithNamespaces
> {
  state = {
    activeScan: false,
  };

  _willFocus: any;
  _willBlur: any;
  _timer: NodeJS.Timeout | null | undefined;

  componentDidMount() {
    this._willFocus = this.props.navigation.addListener("willFocus", () =>
      this._setTimer()
    );
    this._willBlur = this.props.navigation.addListener("willBlur", () =>
      this._clearTimer()
    );
  }

  componentWillUnmount() {
    this._willFocus.remove();
    this._willBlur.remove();
  }

  _setTimer() {
    this.setState({ activeScan: false });
    // Timeout after 30 seconds
    this._clearTimer();
    this._timer = setTimeout(() => {
      if (this.props.navigation.isFocused()) {
        this.props.navigation.push("ManualEntry");
      }
    }, 30000);
  }

  _clearTimer() {
    if (this._timer != null) {
      clearTimeout(this._timer);
      this._timer = null;
    }
  }

  _onBarCodeScanned = async ({ type, data }: { type: any; data: string }) => {
    const { t } = this.props;
    const barcode = data.toLowerCase();

    if (!this.state.activeScan) {
      this.setState({ activeScan: true });
      if (!validBarcodeShape(barcode)) {
        const priorUnverifiedAttempts = !!this.props.invalidBarcodes
          ? this.props.invalidBarcodes.length
          : 0;
        this.props.dispatch(
          appendInvalidBarcode({
            sample_type: type,
            code: barcode,
          })
        );
        if (priorUnverifiedAttempts > 2) {
          this.props.navigation.push("BarcodeContactSupport");
        } else {
          invalidBarcodeShapeAlert(barcode, this._setTimer);
        }
      } else {
        this.props.dispatch(
          setKitBarcode({
            sample_type: type,
            code: barcode,
          })
        );
        this.props.navigation.push("ScanConfirmation");
      }
    }
  };

  _onManualEntry = () => {
    this.props.navigation.push("ManualEntry");
  };

  render() {
    const { t } = this.props;
    return (
      <Chrome navigation={this.props.navigation}>
        <View style={{ flex: 1 }}>
          <BarCodeScanner
            style={{ flex: 1, alignSelf: "stretch" }}
            onBarCodeScanned={this._onBarCodeScanned}
          />
          <View style={scanStyles.overlayContainer}>
            <View style={scanStyles.targetBox} />
            <TouchableOpacity
              style={scanStyles.overlay}
              onPress={this._onManualEntry}
            >
              <Text
                center={true}
                content={t("enterManually")}
                style={scanStyles.overlayText}
              />
            </TouchableOpacity>
          </View>
        </View>
      </Chrome>
    );
  }
}
const scanStyles = StyleSheet.create({
  overlayText: {
    color: "white",
    textDecorationLine: "underline",
  },
  overlay: {
    alignItems: "center",
    height: 50,
    justifyContent: "center",
    marginTop: 50,
    width: 300,
  },
  overlayContainer: {
    alignItems: "center",
    backgroundColor: "transparent",
    height: Dimensions.get("window").height,
    left: -GUTTER,
    justifyContent: "center",
    position: "absolute",
    top: 0,
    width: Dimensions.get("window").width,
  },
  targetBox: {
    borderColor: "#F5A623",
    borderRadius: 2,
    borderWidth: 4,
    height: 250,
    width: 250,
  },
});
export const Scan = withNamespaces("scanScreen")(ScanScreen);

class ManualEntryScreen extends React.Component<Props & WithNamespaces> {
  barcodeEntry = React.createRef<any>();

  _onNext = () => {
    if (this.barcodeEntry.current!.save()) {
      this.props.navigation.push("ManualConfirmation");
    }
  };

  render() {
    const { t } = this.props;
    return (
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={KEYBOARD_BEHAVIOR}
        enabled
      >
        <Screen
          buttonLabel={t("common:button:continue")}
          desc={t("desc")}
          navigation={this.props.navigation}
          title={t("title")}
          onNext={this._onNext}
        >
          <BarcodeEntry customRef={this.barcodeEntry} />
          <View
            style={{
              alignItems: "center",
              alignSelf: "stretch",
              flexDirection: "row",
              justifyContent: "space-between",
              marginTop: GUTTER,
            }}
          >
            <Image
              style={{ aspectRatio: 2.2, flex: 0.4 }}
              source={{ uri: "barcode" }}
            />
            <View style={{ flex: 0.6, paddingLeft: GUTTER }}>
              <Text
                bold={true}
                content={t("tipHeader")}
                style={{ marginBottom: GUTTER }}
              />
              <Text content={t("tips")} />
            </View>
          </View>
        </Screen>
      </KeyboardAvoidingView>
    );
  }
}
export const ManualEntry = withNamespaces("manualEntryScreen")(
  ManualEntryScreen
);

interface FirstTimerProps {
  oneMinuteStartTime: number | undefined;
}

interface DemoModeProps {
  isDemo: boolean;
}

@connect((state: StoreState) => ({
  isDemo: state.meta.isDemo,
}))
class FirstTimerScreen extends React.Component<
  Props & DemoModeProps & FirstTimerProps & WithNamespaces & TimerProps
> {
  _onTitlePress = () => {
    this.props.isDemo && this.props.onFastForward();
  };

  _onNext = () => {
    this.props.onNext();
    this.props.navigation.push("RemoveSwabFromTube");
  };

  render() {
    const { t } = this.props;
    return (
      <Screen
        desc={this.props.getRemainingTime() > 30 * 1000 ? t("tip") : t("tip2")}
        footer={
          <View
            style={{
              alignSelf: "stretch",
              alignItems: "center",
              marginBottom: GUTTER,
            }}
          >
            {!this.props.done() && (
              <View style={{ alignSelf: "stretch" }}>
                <Text
                  content={t("note")}
                  style={{ alignSelf: "stretch", marginBottom: GUTTER }}
                />
                <BorderView
                  style={{
                    alignSelf: "center",
                    borderRadius: BORDER_RADIUS,
                    width: BUTTON_WIDTH,
                  }}
                >
                  <Text
                    bold={true}
                    content={this.props.getRemainingLabel()}
                    style={{ color: SECONDARY_COLOR }}
                  />
                </BorderView>
              </View>
            )}
          </View>
        }
        image="oneminutetimer"
        navigation={this.props.navigation}
        skipButton={!this.props.done()}
        title={t("title")}
        onNext={this._onNext}
        onTitlePress={this._onTitlePress}
      />
    );
  }
}
export const FirstTimer = timerWithConfigProps({
  totalTimeMs: MINUTE_MS,
  startTimeConfig: "oneMinuteStartTime",
  nextScreen: "RemoveSwabFromTube",
})(withNamespaces("firstTimerScreen")(FirstTimerScreen));

class WhenSymptomsScreen extends React.Component<
  Props & WithNamespaces & ReduxWriterProps
> {
  _onNext = () => {
    this.props.navigation.push("GeneralExposure");
  };

  _createQuestions = () => {
    const questions: any = [];

    WhenSymptomsScreenConfig.forEach((question: any) => {
      return this.props
        .getAnswer("options", WhatSymptomsConfig.id)
        .filter((option: Option) => option.selected)
        .forEach((option: Option) => {
          questions.push({
            buttons: question.buttons,
            description: option.key,
            id: question.id + "_" + option.key,
            required: question.required,
            title: question.title,
            type: "buttonGrid",
          });
        });
    });
    return questions;
  };

  render() {
    const { getAnswer, navigation, t, updateAnswer } = this.props;
    return (
      <Screen
        centerDesc={true}
        questions={this._createQuestions()}
        desc={t("description")}
        getAnswer={getAnswer}
        hasDivider={true}
        navigation={navigation}
        title={t("title")}
        updateAnswer={updateAnswer}
        onNext={this._onNext}
      />
    );
  }
}
export const WhenSymptoms = reduxWriter(
  withNamespaces("surveyScreen")(WhenSymptomsScreen)
);

class GeneralExposureScreen extends React.Component<
  Props & WithNamespaces & ReduxWriterProps
> {
  _onNext = () => {
    this.props.navigation.push("GeneralHealth");
  };

  render() {
    const { t, getAnswer, navigation, updateAnswer } = this.props;
    const header = (
      <Fragment>
        <Text content={t("expoDesc")} style={{ marginBottom: GUTTER }} />
        <Image style={imageStyles.image} source={{ uri: "generalexposure" }} />
        <Text
          content={t("expoRef")}
          italic={true}
          style={{ marginBottom: GUTTER }}
        />
      </Fragment>
    );

    return (
      <Screen
        centerDesc={true}
        questions={GeneralExposureScreenConfig}
        desc={t("description")}
        getAnswer={getAnswer}
        hasDivider={true}
        header={header}
        navigation={navigation}
        onNext={this._onNext}
        title={t("generalExposure")}
        updateAnswer={updateAnswer}
      />
    );
  }
}
export const GeneralExposure = reduxWriter(
  withNamespaces("surveyScreen")(GeneralExposureScreen)
);

interface ThankYouSurveyProps {
  tenMinuteStartTime: number | undefined;
}

@connect((state: StoreState) => ({
  isDemo: state.meta.isDemo,
  tenMinuteStartTime: state.survey.tenMinuteStartTime,
}))
class ThankYouSurveyScreen extends React.Component<
  Props & DemoModeProps & WithNamespaces & ThankYouSurveyProps & TimerProps
> {
  componentDidMount() {
    tracker.logEvent(FunnelEvents.COMPLETED_SURVEY);
  }

  _onNext = () => {
    this.props.onNext();
    this.props.navigation.push("TestStripReady");
  };

  _onTitlePress = () => {
    this.props.isDemo && this.props.onFastForward();
  };

  render() {
    const { t } = this.props;
    return (
      <Screen
        desc={t("desc")}
        footer={
          this.props.done() ? (
            undefined
          ) : (
            <BorderView
              style={{
                alignSelf: "center",
                borderRadius: BORDER_RADIUS,
                width: BUTTON_WIDTH,
              }}
            >
              <Text
                bold={true}
                content={this.props.getRemainingLabel()}
                style={{ color: SECONDARY_COLOR }}
              />
            </BorderView>
          )
        }
        image="questionsthankyou"
        navigation={this.props.navigation}
        skipButton={!this.props.done()}
        title={t("title")}
        onNext={this._onNext}
        onTitlePress={this._onTitlePress}
      >
        {!this.props.done() && (
          <Text content={t("waiting")} style={{ alignSelf: "stretch" }} />
        )}
      </Screen>
    );
  }
}
export const ThankYouSurvey = timerWithConfigProps({
  totalTimeMs: TEST_STRIP_MS,
  startTimeConfig: "tenMinuteStartTime",
  nextScreen: "TestStripReady",
})(withNamespaces("thankYouSurveyScreen")(ThankYouSurveyScreen));

class TestStripSurveyScreen extends React.Component<
  Props & WithNamespaces & ReduxWriterProps
> {
  _onNext = () => {
    const getAnswer = this.props.getAnswer;
    const blueAnswer = getAnswer("selectedButtonKey", BlueLineConfig.id);

    switch (blueAnswer) {
      case "yes":
        const redAnswer = getAnswer("selectedButtonKey", RedWhenBlueConfig.id);

        tracker.logEvent(FunnelEvents.RESULT_BLUE);
        switch (redAnswer) {
          case "yesAboveBlue":
          case "yesBelowBlue":
          case "yesAboveBelowBlue":
            tracker.logEvent(FunnelEvents.RESULT_BLUE_ANY_RED);
            break;
          case "noRed":
            tracker.logEvent(FunnelEvents.RESULT_BLUE_NO_RED);
            break;
        }
        break;

      case "no":
        tracker.logEvent(FunnelEvents.RESULT_NO_BLUE);
        break;
    }

    this.props.navigation.push("TestResult");
  };

  render() {
    const { t } = this.props;
    return (
      <Screen
        desc={t("desc")}
        image="lookatteststrip"
        navigation={this.props.navigation}
        questions={TestStripSurveyConfig}
        title={t("title")}
        getAnswer={this.props.getAnswer}
        onNext={this._onNext}
        updateAnswer={this.props.updateAnswer}
      />
    );
  }
}
export const TestStripSurvey = reduxWriter(
  withNamespaces("testStripSurveyScreen")(TestStripSurveyScreen)
);

class CameraSettingsScreen extends React.Component<Props & WithNamespaces> {
  render() {
    const { t } = this.props;
    return (
      <Screen
        desc={Platform.OS === "android" ? t("descAndroid") : t("desc")}
        image="updatesettings"
        navigation={this.props.navigation}
        skipButton={true}
        title={t("title")}
      />
    );
  }
}
export const CameraSettings = withNamespaces("CameraSettings")(
  CameraSettingsScreen
);

@connect()
class RDTReaderScreen extends React.Component<Props & WithNamespaces> {
  camera = React.createRef<any>();

  constructor(props: Props & WithNamespaces) {
    super(props);
    this._takePicture = this._takePicture.bind(this);
  }

  state = {
    spinner: !DeviceInfo.isEmulator(),
  };

  _cameraReady = () => {
    this.setState({ spinner: false });
  };

  async _takePicture() {
    if (!this.state.spinner) {
      this.setState({ spinner: true });

      try {
        const photo = await this.camera.current!.takePictureAsync({
          quality: 0.8,
          base64: true,
          orientation: "portrait",
          fixOrientation: true,
        });
        const csruid = await newCSRUID();
        uploader.savePhoto(csruid, photo.base64);
        this.props.dispatch(
          setTestStripImg({
            sample_type: "TestStripBase64",
            code: csruid,
          })
        );
        this.props.dispatch(setRDTPhoto(photo.uri));
        this.setState({ spinner: false });
        this.props.navigation.push("TestStripConfirmation");
      } catch (e) {
        this.setState({ spinner: false });
      }
    }
  }

  render() {
    const { t } = this.props;
    return (
      <Chrome navigation={this.props.navigation}>
        <View style={{ flex: 1, marginBottom: -1 * SYSTEM_PADDING_BOTTOM }}>
          <Spinner visible={this.state.spinner} />
          <Camera
            ref={this.camera}
            style={cameraStyles.camera}
            onCameraReady={this._cameraReady}
          />
          <View style={cameraStyles.overlayContainer}>
            <Text
              center={true}
              content={t("title")}
              style={cameraStyles.overlayText}
            />
            <View style={cameraStyles.innerContainer}>
              <Image
                style={cameraStyles.testStrip}
                source={{ uri: "teststripdetail" }}
              />
              <View style={{ flex: 1, marginLeft: GUTTER }}>
                <Text
                  center={true}
                  content={t("stripHere")}
                  style={cameraStyles.overlayText}
                />
                <View style={cameraStyles.targetBox} />
              </View>
            </View>
            <View style={{ alignItems: "center", alignSelf: "stretch" }}>
              <Text
                center={true}
                content={t("description")}
                style={cameraStyles.overlayText}
              />
              <TouchableOpacity onPress={this._takePicture}>
                <View style={cameraStyles.outerCircle}>
                  <View style={cameraStyles.circle} />
                </View>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Chrome>
    );
  }
}

export const RDTReader = withNamespaces("RDTReader")(RDTReaderScreen);

const imageStyles = StyleSheet.create({
  image: {
    aspectRatio: ASPECT_RATIO,
    height: undefined,
    marginBottom: GUTTER,
    width: "100%",
  },
});

const cameraStyles = StyleSheet.create({
  camera: {
    alignSelf: "stretch",
    flex: 1,
  },
  innerContainer: {
    height: "100%",
    flexDirection: "row",
    flex: 1,
    marginHorizontal: GUTTER * 2,
    marginBottom: GUTTER,
  },
  outerCircle: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
    borderColor: "white",
    borderWidth: 7,
    borderRadius: 40,
    height: 80,
    width: 80,
  },
  circle: {
    backgroundColor: "white",
    borderColor: "transparent",
    borderRadius: 30,
    borderWidth: 3,
    height: 60,
    width: 60,
  },
  overlayText: {
    color: "white",
    fontSize: LARGE_TEXT,
    marginVertical: GUTTER,
    textShadowColor: "rgba(0, 0, 0, 0.99)",
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 10,
  },
  overlayContainer: {
    alignItems: "center",
    justifyContent: "space-between",
    left: 0,
    right: 0,
    position: "absolute",
    top: 0,
    bottom: 0,
    marginBottom: GUTTER + SYSTEM_PADDING_BOTTOM,
  },
  targetBox: {
    alignSelf: "center",
    borderColor: "white",
    borderRadius: 5,
    borderStyle: "dashed",
    borderWidth: 4,
    flex: 1,
    shadowColor: "rgba(0, 0, 0, 0.99)",
    shadowOffset: { width: -1, height: 1 },
    shadowRadius: 10,
    width: "65%",
  },
  testStrip: {
    alignSelf: "center",
    aspectRatio: 0.135,
    height: "95%",
    marginTop: GUTTER,
    marginLeft: GUTTER,
    width: undefined,
  },
});
