// Copyright (c) 2019 by Audere
//
// Use of this source code is governed by an LGPL-3.0 license that
// can be found in the LICENSE file distributed with this file.

import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { NavigationScreenProp } from "react-navigation";
import { connect } from "react-redux";
import {
  Action,
  StoreState,
  setAdministrator,
  setAdmins,
} from "../../../store";
import BackButton from "../../components/BackButton";
import Button from "../../components/Button";
import FeedbackButton from "../../components/FeedbackButton";
import FeedbackModal from "../../components/FeedbackModal";
import OptionList, {
  newSelectedOptionsList,
} from "../../components/OptionList";
import TextInput from "../../components/TextInput";
import ScreenContainer from "../../components/ScreenContainer";

interface Props {
  administrator: string;
  admins: string[];
  navigation: NavigationScreenProp<any, any>;
  dispatch(action: Action): void;
}

@connect((state: StoreState) => ({
  administrator: state.admin.administrator,
  admins: state.admin.admins,
}))
export default class SelectAdminScreen extends React.Component<Props> {
  static navigationOptions = ({
    navigation,
  }: {
    navigation: NavigationScreenProp<any, any>;
  }) => {
    const { params = null } = navigation.state;
    return {
      title: "Select Administrator",
      headerLeft: (
        <BackButton navigation={navigation} text={"Prior to Collection"} />
      ),
      headerRight: !!params ? (
        <FeedbackButton onPress={params.showFeedback} />
      ) : null,
    };
  };

  state = {
    feedbackVisible: false,
    name: null,
  };

  componentDidMount() {
    this.props.navigation.setParams({
      showFeedback: () => this.setState({ feedbackVisible: true }),
    });
  }

  _getSelectedOptions = () => {
    return this.props.admins.map(admin => {
      return {
        key: admin,
        selected: this.props.administrator === admin,
      };
    });
  };

  _addName = () => {
    if (!!this.state.name) {
      // @ts-ignore
      const name = this.state.name.trim();
      if (name.length == 0) {
        return;
      }
      this.props.dispatch(setAdministrator(name));
      const admins = !!this.props.admins ? this.props.admins.slice(0) : [];
      admins.push(name);
      this.props.dispatch(setAdmins(admins));
      this.setState({ name: null });
    }
  };

  render() {
    return (
      <ScreenContainer>
        <FeedbackModal
          visible={this.state.feedbackVisible}
          onDismiss={() => this.setState({ feedbackVisible: false })}
        />
        <Text style={styles.sectionHeaderText}>Study Administrators</Text>
        <View style={styles.container}>
          <TextInput
            autoCorrect={false}
            autoFocus={!(this.props.admins && this.props.admins.length > 0)}
            placeholder="Add administrator"
            returnKeyType="done"
            style={styles.inputText}
            value={this.state.name}
            onChangeText={(text: string) => {
              this.setState({ name: text });
            }}
            onSubmitEditing={this._addName}
          />
          <Button
            enabled={!!this.state.name}
            key="add"
            label="Add"
            primary={true}
            style={styles.button}
            onPress={this._addName}
          />
        </View>
        {!!this.props.admins && this.props.admins.length > 0 && (
          <View>
            <OptionList
              data={this._getSelectedOptions()}
              numColumns={1}
              multiSelect={false}
              fullWidth={true}
              backgroundColor="#fff"
              onChange={data => {
                const admin = data.find(option => option.selected);
                if (!!admin) {
                  this.props.dispatch(setAdministrator(admin.key));
                }
              }}
            />
            <View style={styles.buttonContainer}>
              <Button
                enabled={true}
                key="clear"
                label="Clear All"
                primary={false}
                style={styles.button}
                onPress={() => {
                  this.props.dispatch(setAdmins([]));
                  this.props.dispatch(setAdministrator(null));
                }}
              />
            </View>
          </View>
        )}
      </ScreenContainer>
    );
  }
}

const styles = StyleSheet.create({
  buttonContainer: {
    flexDirection: "row",
    justifyContent: "center",
    margin: 10,
  },
  button: {
    marginVertical: 0,
    width: 250,
  },
  container: {
    flexDirection: "row",
    margin: 10,
  },
  inputText: {
    flex: 1,
    height: 50,
    marginRight: 15,
    marginVertical: 0,
  },
  sectionHeaderText: {
    marginTop: 35,
    marginLeft: 15,
    fontSize: 24,
  },
});
