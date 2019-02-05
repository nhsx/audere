import React from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Text as SystemText,
  View,
  ScrollView,
  StyleSheet,
} from "react-native";
import { NavigationScreenProp } from "react-navigation";
import { connect } from "react-redux";
import { WithNamespaces, withNamespaces } from "react-i18next";
import {
  Action,
  Address,
  Option,
  startForm,
  StoreState,
  SurveyResponse,
} from "../store";
import {
  AddressConfig,
  AgeConfig,
  ConsentConfig,
  SymptomsConfig,
} from "../resources/ScreenConfig";
import { ButtonConfig } from "../resources/QuestionnaireConfig";
import reduxWriter, { ReduxWriterProps } from "../store/ReduxWriter";
import AddressInput from "./components/AddressInput";
import Button from "./components/Button";
import Screen from "./components/Screen";
import Links from "./components/Links";
import OptionList, { newSelectedOptionsList } from "./components/OptionList";
import Text from "./components/Text";

interface Props {
  dispatch(action: Action): void;
  navigation: NavigationScreenProp<any, any>;
}

@connect()
class WelcomeScreen extends React.Component<Props & WithNamespaces> {
  _onNext = () => {
    this.props.dispatch(startForm());
    this.props.navigation.push("Why");
  };

  render() {
    const { t } = this.props;
    return (
      <Screen
        canProceed={true}
        desc={t("description")}
        imageSrc={require("../img/welcome.png")}
        logo={true}
        navBar={false}
        navigation={this.props.navigation}
        title={t("welcome")}
        onNext={this._onNext}
      />
    );
  }
}
const Welcome = withNamespaces("welcomeScreen")<Props>(WelcomeScreen);

class WhyScreen extends React.Component<Props & WithNamespaces> {
  _onNext = () => {
    this.props.navigation.push("What");
  };

  render() {
    const { t } = this.props;
    return (
      <Screen
        canProceed={true}
        desc={t("description")}
        imageSrc={require("../img/why.png")}
        logo={true}
        navBar={false}
        navigation={this.props.navigation}
        title={t("why")}
        onNext={this._onNext}
      />
    );
  }
}
const Why = withNamespaces("whyScreen")<Props>(WhyScreen);

class WhatScreen extends React.Component<Props & WithNamespaces> {
  _onNext = () => {
    this.props.navigation.push("Age", { data: AgeConfig });
  };

  render() {
    const { t } = this.props;
    return (
      <Screen
        canProceed={true}
        desc={t("description")}
        imageSrc={require("../img/what.png")}
        logo={true}
        navBar={false}
        navigation={this.props.navigation}
        title={t("what")}
        onNext={this._onNext}
      />
    );
  }
}
const What = withNamespaces("whatScreen")<Props>(WhatScreen);

class AgeScreen extends React.Component<
  Props & WithNamespaces & ReduxWriterProps
> {
  _onDone = () => {
    this.props.navigation.push("Symptoms", { data: SymptomsConfig });
  };

  render() {
    const { t } = this.props;
    return (
      <Screen
        canProceed={!!this.props.getAnswer("selectedButtonKey")}
        logo={false}
        navBar={true}
        navigation={this.props.navigation}
        skipButton={true}
        step={1}
        title={t("surveyTitle:" + AgeConfig.title)}
        onNext={this._onDone}
      >
        {AgeConfig.buttons.map((button: ButtonConfig) => (
          <Button
            checked={this.props.getAnswer("selectedButtonKey") === button.key}
            enabled={true}
            key={button.key}
            label={t("surveyButton:" + button.key)}
            primary={button.primary}
            style={{ marginVertical: 15 }}
            onPress={() => {
              this.props.updateAnswer({ selectedButtonKey: button.key });
              this._onDone();
            }}
          />
        ))}
      </Screen>
    );
  }
}
const Age = reduxWriter(withNamespaces("ageScreen")(AgeScreen));

@connect()
class SymptomsScreen extends React.PureComponent<
  Props & WithNamespaces & ReduxWriterProps
> {
  _onDone = () => {
    this.props.updateAnswer({ selectedButtonKey: "next" });
    const { t } = this.props;
    if (this._numSymptoms() > 1) {
      Alert.alert(t("thankYou"), t("nextStep"), [
        {
          text: t("headerBar:continue"),
          onPress: () => {
            this.props.navigation.push("Consent", { data: ConsentConfig });
          },
        },
      ]);
    } else {
      Alert.alert(t("areYouSure"), t("minSymptoms"), [
        {
          text: t("headerBar:cancel"),
          onPress: () => {},
        },
        {
          text: t("headerBar:continue"),
          onPress: () => {
            this.props.navigation.push("Ineligible");
          },
        },
      ]);
    }
  };

  _haveOption = () => {
    const symptoms: Option[] = this.props.getAnswer("options");
    return symptoms
      ? symptoms.reduce(
          (result: boolean, option: Option) => result || option.selected,
          false
        )
      : false;
  };

  _numSymptoms = () => {
    const symptoms: Option[] = this.props.getAnswer("options");
    return symptoms
      ? symptoms.reduce(
          (count: number, option: Option) =>
            option.selected && option.key !== "noneOfTheAbove"
              ? count + 1
              : count,
          0
        )
      : 0;
  };

  render() {
    const { t } = this.props;
    return (
      <Screen
        canProceed={this._haveOption()}
        centerDesc={true}
        desc={t("surveyDescription:" + SymptomsConfig.description!.label)}
        logo={false}
        navBar={true}
        navigation={this.props.navigation}
        step={2}
        title={t("surveyTitle:" + SymptomsConfig.title)}
        onNext={this._onDone}
      >
        <OptionList
          data={newSelectedOptionsList(
            SymptomsConfig.optionList!.options,
            this.props.getAnswer("options")
          )}
          multiSelect={true}
          numColumns={1}
          exclusiveOption="noneOfTheAbove"
          onChange={symptoms => this.props.updateAnswer({ options: symptoms })}
        />
      </Screen>
    );
  }
}
const Symptoms = reduxWriter(withNamespaces("symptomsScreen")(SymptomsScreen));

interface AddressProps {
  name: string;
  navigation: NavigationScreenProp<any, any>;
  responses: SurveyResponse[];
}

interface AddressState {
  address?: Address;
}

@connect((state: StoreState) => ({
  name: state.form.name,
  responses: state.form.responses,
}))
class AddressScreen extends React.Component<
  AddressProps & WithNamespaces & ReduxWriterProps,
  AddressState
> {
  constructor(props: AddressProps & WithNamespaces & ReduxWriterProps) {
    super(props);
    const addressResponse = props.responses.find(
      response => response.questionId === AddressConfig.id
    );
    if (
      addressResponse != null &&
      addressResponse.answer != null &&
      addressResponse.answer.addressInput != null
    ) {
      this.state = {
        address: addressResponse.answer.addressInput,
      };
    } else {
      this.state = {
        address: {
          name: props.name,
        },
      };
    }
  }

  _onDone = () => {
    this.props.updateAnswer({
      addressInput: this.state.address,
    });
    this.props.navigation.push("Confirmation");
  };

  _haveValidAddress = (): boolean => {
    const address = this.state.address;
    return (
      !!address &&
      !!address.name &&
      !!address.address &&
      !!address.city &&
      !!address.state &&
      !!address.zipcode
    );
  };

  render() {
    const { t } = this.props;
    return (
      <Screen
        buttonLabel={t("common:button:submit")}
        canProceed={this._haveValidAddress()}
        centerDesc={true}
        desc={t("surveyDescription:" + AddressConfig.description!.label)}
        logo={false}
        navBar={true}
        navigation={this.props.navigation}
        step={5}
        title={t("surveyTitle:" + AddressConfig.title)}
        onNext={this._onDone}
      >
        <AddressInput
          value={this.state.address}
          onChange={(address: Address) => this.setState({ address })}
          onDone={() => {
            if (this._haveValidAddress()) {
              this._onDone();
            }
          }}
        />
      </Screen>
    );
  }
}
const Address = reduxWriter(withNamespaces()(AddressScreen));

class IneligibleScreen extends React.Component<Props & WithNamespaces> {
  render() {
    const { t } = this.props;
    return (
      <Screen
        buttonLabel={t("returnHome")}
        canProceed={true}
        imageSrc={require("../img/ineligible.png")}
        logo={true}
        navBar={false}
        navigation={this.props.navigation}
        title={t("ineligible")}
        desc={t("description")}
        onNext={() => this.props.navigation.popToTop()}
      >
        <Links />
        <Text content={t("disclaimer")} style={{ fontSize: 12 }} />
      </Screen>
    );
  }
}
const Ineligible = withNamespaces("ineligibleScreen")<Props>(IneligibleScreen);

class ConfirmationScreen extends React.Component<Props & WithNamespaces> {
  _onNext = () => {
    this.props.navigation.push("PushNotifications");
  };

  render() {
    const { t } = this.props;
    return (
      <Screen
        canProceed={true}
        desc={t("description")}
        imageSrc={require("../img/confirmation.png")}
        logo={true}
        navBar={true}
        navigation={this.props.navigation}
        title={t("confirmed")}
        onNext={this._onNext}
      />
    );
  }
}
const Confirmation = withNamespaces("confirmationScreen")<Props>(
  ConfirmationScreen
);

class PushNotificationsScreen extends React.Component<Props & WithNamespaces> {
  _onYes = () => {
    // TODO want to only set onNext in nav bar to onYes if they push yes...
    // TODO save response
    this.props.navigation.push("Instructions");
  };

  _onNo = () => {
    // TODO save response
    this.props.navigation.push("Instructions");
  };

  render() {
    const { t } = this.props;
    return (
      <Screen
        buttonLabel={t("common:button:yes")}
        canProceed={true}
        desc={t("description")}
        imageSrc={require("../img/pushNotifications.png")}
        logo={true}
        navBar={true}
        navigation={this.props.navigation}
        title={t("pushNotifications")}
        onNext={this._onYes}
      >
        <Button
          enabled={true}
          primary={true}
          label={t("common:button:no")}
          style={{ marginVertical: 10 }}
          onPress={this._onNo}
        />
      </Screen>
    );
  }
}
const PushNotifications = withNamespaces("pushNotificationsScreen")<Props>(
  PushNotificationsScreen
);

class InstructionsScreen extends React.Component<Props & WithNamespaces> {
  _onNext = () => {
    this.props.navigation.push("ExtraInfo");
  };

  render() {
    const { t } = this.props;
    return (
      <Screen
        canProceed={true}
        desc={t("description")}
        imageSrc={require("../img/instructions.png")}
        logo={true}
        navBar={true}
        navigation={this.props.navigation}
        title={t("instructions")}
        onNext={this._onNext}
      />
    );
  }
}
const Instructions = withNamespaces("instructionsScreen")<Props>(
  InstructionsScreen
);

class ExtraInfoScreen extends React.Component<Props & WithNamespaces> {
  _onNext = () => {
    this.props.navigation.push("Welcome");
  };

  render() {
    const { t } = this.props;
    return (
      <Screen
        buttonLabel={t("close")}
        canProceed={true}
        imageSrc={require("../img/extraInfo.png")}
        logo={true}
        navBar={true}
        navigation={this.props.navigation}
        title={t("extraInfo")}
        onNext={this._onNext}
      >
        <Links />
      </Screen>
    );
  }
}
const ExtraInfo = withNamespaces("extraInfoScreen")<Props>(ExtraInfoScreen);

export {
  Welcome,
  Why,
  What,
  Age,
  Symptoms,
  Address,
  Ineligible,
  Confirmation,
  PushNotifications,
  Instructions,
  ExtraInfo,
};
