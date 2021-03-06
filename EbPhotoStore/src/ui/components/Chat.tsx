// Copyright (c) 2019 by Audere
//
// Use of this source code is governed by an LGPL-3.0 license that
// can be found in the LICENSE file distributed with this file.

import React, { Fragment } from "react";
import { StyleSheet } from "react-native";
import firebase from "react-native-firebase";
import { Message } from "audere-lib/ebPhotoStoreProtocol";
import Text from "./Text";
import { WithNamespaces, withNamespaces } from "react-i18next";
import {
  CHAT_LOCAL_MESSAGE_COLOR,
  CHAT_REMOTE_MESSAGE_COLOR,
  GUTTER,
  SMALL_TEXT,
} from "../styles";

interface Props {
  messages: Message[];
}

export default class Chat extends React.Component<Props> {
  _chatMessages: any = [];

  render() {
    const { messages } = this.props;
    const uid = firebase.auth().currentUser!.uid;
    return (
      <Fragment>
        {[...messages]
          .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
          .map((message, index) => (
            <TranslatedChatMessage
              ref={(tcm: ChatMessage) => (this._chatMessages[index] = tcm)}
              key={message.sender.uid + message.timestamp}
              local={message.sender.uid === uid}
              message={message}
            />
          ))}
      </Fragment>
    );
  }

  getChatMessage(msg: Message): any {
    return this._chatMessages.find((tcm: ChatMessage) => {
      if (tcm.props.message === msg) {
        return tcm;
      }
    });
  }
}

interface MessageProps {
  local: boolean;
  message: Message;
  ref: any;
}

class ChatMessage extends React.Component<MessageProps & WithNamespaces> {
  render() {
    const { local, message, ref, t } = this.props;
    return (
      <Fragment>
        <Text
          content={message.content}
          ref={ref}
          style={[
            styles.message,
            local && styles.local,
            local ? styles.localMessage : styles.foreignMessage,
          ]}
        />
        <Text
          content={t("dateTime", { date: new Date(message.timestamp) })}
          italic={true}
          style={[styles.sender, local && styles.local]}
        />
        {!local && (
          <Text
            content={message.sender.name}
            italic={true}
            style={styles.sender}
          />
        )}
      </Fragment>
    );
  }
}
const TranslatedChatMessage = withNamespaces("common")(ChatMessage);

const styles = StyleSheet.create({
  message: {
    borderRadius: 10,
    marginTop: GUTTER,
    padding: GUTTER / 2,
  },
  foreignMessage: {
    alignSelf: "flex-start",
    backgroundColor: CHAT_REMOTE_MESSAGE_COLOR,
  },
  local: {
    textAlign: "right",
  },
  localMessage: {
    alignSelf: "flex-end",
    backgroundColor: CHAT_LOCAL_MESSAGE_COLOR,
  },
  sender: {
    fontSize: SMALL_TEXT,
    marginTop: 0,
    paddingHorizontal: GUTTER / 2,
  },
});
