// Copyright (c) 2019 by Audere
//
// Use of this source code is governed by an LGPL-3.0 license that
// can be found in the LICENSE file distributed with this file.

import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { WithNamespaces, withNamespaces } from "react-i18next";

interface Props {
  canProceed: boolean;
  progressNumber?: string;
  progressLabel?: string;
  title: string;
  onBack: any;
  onForward: any;
}

class StatusBar extends React.Component<Props & WithNamespaces> {
  _back = () => {
    this.props.onBack();
  };

  _forward = () => {
    this.props.onForward();
  };

  render() {
    const { t } = this.props;
    return (
      <View style={styles.statusBar}>
        <View>
          {!!this.props.progressLabel && (
            <Text style={styles.progressText}>{this.props.progressLabel}</Text>
          )}
          <Text style={[styles.progressText, styles.progressNumber]}>
            {this.props.progressNumber}
            {" " + t("complete")}
          </Text>
        </View>
        <Text numberOfLines={1} style={styles.statusBarTitle}>
          {this.props.title}
        </Text>
        <View style={styles.nav}>
          <TouchableOpacity onPress={this._back}>
            <Feather
              color="blue"
              style={[styles.icon, styles.iconLeft]}
              name="chevron-up"
              size={40}
            />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={this._forward}
            disabled={!this.props.canProceed}
          >
            <Feather
              color={this.props.canProceed ? "blue" : "gray"}
              style={styles.icon}
              name="chevron-down"
              size={40}
            />
          </TouchableOpacity>
        </View>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  icon: {
    padding: 5,
  },
  iconLeft: {
    borderColor: "blue",
    borderRightWidth: StyleSheet.hairlineWidth,
  },
  nav: {
    alignItems: "center",
    borderColor: "blue",
    borderRadius: 5,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    justifyContent: "center",
  },
  progressText: {
    color: "#444444",
    fontFamily: "OpenSans-Regular",
    fontSize: 17,
    letterSpacing: -0.35,
    lineHeight: 22,
  },
  progressNumber: {
    fontFamily: "OpenSans-SemiBold",
  },
  statusBar: {
    alignItems: "center",
    backgroundColor: "#F6F6F6",
    flexDirection: "row",
    height: 90,
    justifyContent: "space-between",
    padding: 20,
    shadowColor: "#000000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowRadius: 2,
    shadowOpacity: 0.5,
  },
  statusBarTitle: {
    color: "#444444",
    fontFamily: "OpenSans-Bold",
    fontSize: 30,
    letterSpacing: -0.41,
    textAlign: "center",
    width: 500,
  },
});

export default withNamespaces("statusBar")<Props>(StatusBar);
