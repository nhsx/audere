// Copyright (c) 2019 by Audere
//
// Use of this source code is governed by an LGPL-3.0 license that
// can be found in the LICENSE file distributed with this file.

import React from "react";
import {
  Alert,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { WithNamespaces, withNamespaces } from "react-i18next";
import Modal from "./Modal";
import { uploader } from "../../store/uploader";

const IOS_MODAL_ANIMATION = {
  from: { opacity: 0, scale: 1.2 },
  0.5: { opacity: 1 },
  to: { opacity: 1, scale: 1 },
};

interface Props {
  visible: boolean;
  onDismiss(): void;
}

interface State {
  subject?: string;
  comments?: string;
}

class FeedbackModal extends React.Component<Props & WithNamespaces, State> {
  state: State = {};

  render() {
    const { t } = this.props;
    return (
      <Modal
        title={t("provideFeedback")}
        visible={this.props.visible}
        onDismiss={() => {
          this.setState({ subject: undefined, comments: undefined });
          this.props.onDismiss();
        }}
        onSubmit={() => {
          uploader.saveFeedback(
            (this.state.subject || "").trim(),
            (this.state.comments || "").trim()
          );
          this.setState({ subject: undefined, comments: undefined });
          Alert.alert(t("thankYou"), "", [
            {
              text: t("headerBar:continue"),
              onPress: () => {
                this.props.onDismiss();
              },
            },
          ]);
        }}
      >
        <View style={{ flex: 1 }}>
          <TextInput
            style={[styles.text, styles.subject]}
            placeholder={t("subject")}
            value={this.state.subject}
            onChangeText={text => this.setState({ subject: text })}
          />
          <TextInput
            style={[styles.text, styles.comments]}
            multiline={true}
            placeholder={t("comments")}
            value={this.state.comments}
            onChangeText={text => this.setState({ comments: text })}
          />
        </View>
      </Modal>
    );
  }
}

const styles = StyleSheet.create({
  comments: {
    flex: 1,
    marginVertical: 11,
  },
  subject: {
    justifyContent: "center",
    height: 44,
    borderBottomColor: "#bbb",
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  text: {
    paddingHorizontal: 22,
    fontSize: 17,
    letterSpacing: -0.41,
    lineHeight: 22,
  },
});

export default withNamespaces("feedbackModal")(FeedbackModal);
