// Copyright (c) 2019 by Audere
//
// Use of this source code is governed by an LGPL-3.0 license that
// can be found in the LICENSE file distributed with this file.

import React from "react";
import { StyleSheet, View } from "react-native";
import Text from "./Text";
import { GUTTER } from "../styles";

interface Props {
  content: string;
}

export default class BulletPoint extends React.Component<Props> {
  render() {
    return (
      <View style={styles.container}>
        <Text content={"\u2022  "} />
        <Text content={this.props.content} style={{ flex: 1 }} />
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    alignSelf: "stretch",
    flexDirection: "row",
    marginBottom: GUTTER,
  },
});
