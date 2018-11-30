import React from "react";
import { NavigationScreenProp } from "react-navigation";
import { connect } from "react-redux";
import { WithNamespaces, withNamespaces } from "react-i18next";
import { StoreState } from "../../../store";
import { SurveyQuestionData } from "../../../resources/QuestionnaireConfig";
import reduxWriter, { ReduxWriterProps } from "../../../store/ReduxWriter";
import Button from "../../components/Button";
import ContentContainer from "../../components/ContentContainer";
import Description from "../../components/Description";
import OptionList from "../../components/OptionList";
import ScreenContainer from "../../components/ScreenContainer";
import StatusBar from "../../components/StatusBar";
import Title from "../../components/Title";

interface Props {
  navigation: NavigationScreenProp<any, any>;
  age: number;
  data: SurveyQuestionData;
}

export const SymptomsConfig = {
  id: 'Symptoms',
  title: '3. What symptoms have you experienced in the last week?',
  description: 'Please select all that apply.',
  optionList: {
    options: [
      "feelingFeverish",
      "headaches",
      "cough",
      "diarrhea",
      "soreThroat",
      "nauseaOrVomiting",
      "runnyOrStuffyNose",
      "rash",
      "fatigue",
      "muscleOrBodyAches",
      "increasedTroubleBreathing",
      "earPainOrDischarge",
    ],
    multiSelect: true,
  },
  buttons: [
    { key: "done", primary: true, enabled: "withOption" },
    { key: "noneOfTheAbove", primary: false, enabled: true },
  ],
}

@connect((state: StoreState) => ({
  age: state.form!.age,
}))
class SymptomsScreen extends React.PureComponent<Props & WithNamespaces & ReduxWriterProps> {
  _onDone = () => {
    if (this._numSymptoms() > 1) {
      if (!isNaN(this.props.age) && this.props.age < 18) {
        this.props.navigation.push("Consent");
      } else {
        this.props.navigation.push("Swab");
      }
    } else {
      this.props.navigation.push("Inelligible");
    }
  };

  _numSymptoms = () => {
    const symptoms: Map<string, boolean> = this.props.getAnswer("options");
    return symptoms
      ? Array.from(symptoms.values()).reduce(
          (count: number, value: boolean) => (value ? count + 1 : count),
          0
        )
      : 0;
  };

  _getSelectedOptionMap = (): Map<string, boolean> => {
    const options = this.props.getAnswer("options");
    return options
      ? new Map<string, boolean>(options)
      : OptionList.emptyMap(SymptomsConfig.optionList.options);
  };

  render() {
    return (
      <ScreenContainer>
        <StatusBar
          canProceed={this._numSymptoms() > 0}
          progressNumber="40%"
          progressLabel="Enrollment"
          title="2. What is the age of the participant?"
          onBack={() => this.props.navigation.pop()}
          onForward={this._onDone}
        />
        <ContentContainer>
          <Title label={SymptomsConfig.title} />
          <Description content={SymptomsConfig.description} center={true} />
          <OptionList
            data={this._getSelectedOptionMap()}
            multiSelect={true}
            numColumns={2}
            onChange={symptoms => this.props.updateAnswer({ options: symptoms })}
          />
          {SymptomsConfig.buttons.map(button => (
            <Button
              checked={this.props.getAnswer("selectedButtonKey") === button.key}
              enabled={button.key === "done" ? this._numSymptoms() > 0 : true}
              key={button.key}
              label={this.props.t("surveyButton:" + button.key)}
              onPress={() => {
                if (button.key === "done") {
                  this.props.updateAnswer({ selectedButtonKey: button.key });
                  this._onDone();
                } else {
                  this.props.updateAnswer({ selectedButtonKey: button.key });
                  this.props.navigation.push("Inelligible");
                }
              }}
              primary={button.primary}
            />
          ))}
        </ContentContainer>
      </ScreenContainer>
    );
  }
}

export default reduxWriter(withNamespaces()(SymptomsScreen));
