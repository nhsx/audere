// Copyright (c) 2019 by Audere
//
// Use of this source code is governed by an LGPL-3.0 license that
// can be found in the LICENSE file distributed with this file.

import React from "react";
import { Text, StyleSheet } from "react-native";
import { NavigationScreenProp } from "react-navigation";
import { connect } from "react-redux";
import {
  Action,
  Option,
  StoreState,
  clearForm,
  completeSurvey,
  setAdministrator,
  setBloodCollection,
  setDemo,
} from "../../../store";
import BackButton from "../../components/BackButton";
import EditSettingButton from "../../components/EditSettingButton";
import FeedbackButton from "../../components/FeedbackButton";
import FeedbackModal from "../../components/FeedbackModal";
import KeyValueLine from "../../components/KeyValueLine";
import OptionList from "../../components/OptionList";
import ScreenContainer from "../../components/ScreenContainer";
import { WithNamespaces, withNamespaces } from "react-i18next";

const NORMAL_MODE_OPTION = "Normal";
const DEMO_MODE_OPTION = "Demo Mode (data not used in study)";

interface Props {
  bloodCollection: boolean;
  administrator: string;
  isDemo: boolean;
  location: string;
  navigation: NavigationScreenProp<any, any>;
  screenProps: any;
  dispatch(action: Action): void;
}

function getTodaysDate(): string {
  return new Date().toLocaleDateString();
}

@connect((state: StoreState) => ({
  administrator: state.admin.administrator,
  bloodCollection: state.admin.bloodCollection,
  isDemo: state.admin.isDemo,
  location: state.admin.location,
}))
class PriorScreen extends React.Component<Props & WithNamespaces> {
  static navigationOptions = ({
    navigation,
  }: {
    navigation: NavigationScreenProp<any, any>;
  }) => {
    const { params = null } = navigation.state;
    return {
      headerLeft: (
        <BackButton navigation={navigation} text={"Admin Settings"} />
      ),
      title: "Prior to Collection",
      headerRight: !!params ? (
        <FeedbackButton onPress={params.showFeedback} />
      ) : null,
    };
  };

  state = {
    feedbackVisible: false,
  };

  componentDidMount() {
    this.props.navigation.setParams({
      showFeedback: () => this.setState({ feedbackVisible: true }),
    });
  }

  _onSelectLocation = () => {
    this.props.navigation.push("SelectLocation");
  };

  _getBloodCollectionOptions(bloodCollection: boolean): Option[] {
    return [
      { key: "Available", selected: bloodCollection },
      { key: "Not Available", selected: !bloodCollection },
    ];
  }

  _onSelectAdministrator = () => {
    this.props.navigation.push("SelectAdmin");
  };

  _getDemoModeOptions(isDemo: boolean): Option[] {
    return [
      { key: NORMAL_MODE_OPTION, selected: !isDemo },
      { key: DEMO_MODE_OPTION, selected: isDemo },
    ];
  }

  _onSetDemo = (isDemo: boolean) => {
    this.props.dispatch(completeSurvey());
    this.props.dispatch(clearForm());
    this.props.dispatch(setDemo(isDemo));
  };

  render() {
    const { t } = this.props;
    return (
      <ScreenContainer>
        <FeedbackModal
          visible={this.state.feedbackVisible}
          onDismiss={() => this.setState({ feedbackVisible: false })}
        />
        <KeyValueLine item="Date of Screening" value={getTodaysDate()} />
        <Text style={styles.sectionHeaderText}>Current Administrator</Text>
        <EditSettingButton
          label={this.props.administrator ? this.props.administrator : "Select"}
          onPress={this._onSelectAdministrator}
        />
        <Text style={styles.sectionHeaderText}>Collection Location</Text>
        <EditSettingButton
          label={
            this.props.location
              ? t("surveyOption:" + this.props.location)
              : "Select"
          }
          onPress={this._onSelectLocation}
        />
        <Text style={styles.descriptionText}>
          The site where this device is being used to facilitate sample
          collection
        </Text>
        <Text style={styles.sectionHeaderText}>Blood Collection</Text>
        <OptionList
          data={this._getBloodCollectionOptions(this.props.bloodCollection)}
          numColumns={1}
          fullWidth={true}
          multiSelect={false}
          backgroundColor="#fff"
          onChange={data => {
            const availableOption = data.find(
              option => option.key === "Available"
            )!.selected;
            this.props.dispatch(setBloodCollection(!!availableOption));
          }}
        />
        <Text style={styles.descriptionText}>
          If blood sample collection is available at this site, then the option
          to contribute will be given to participants during enrollment.
        </Text>
        <Text style={styles.sectionHeaderText}>Demo Mode</Text>
        <OptionList
          data={this._getDemoModeOptions(this.props.isDemo)}
          numColumns={1}
          fullWidth={true}
          multiSelect={false}
          backgroundColor="#fff"
          onChange={data => {
            this._onSetDemo(
              data.find(option => option.key === DEMO_MODE_OPTION)!.selected
            );
          }}
        />
      </ScreenContainer>
    );
  }
}

const styles = StyleSheet.create({
  sectionHeaderText: {
    marginTop: 35,
    marginBottom: 7,
    marginLeft: 15,
    fontSize: 24,
  },
  descriptionText: {
    marginLeft: 15,
    fontSize: 17,
  },
});

export default withNamespaces()(PriorScreen);
