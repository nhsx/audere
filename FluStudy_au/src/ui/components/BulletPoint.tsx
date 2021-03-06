// Copyright (c) 2019 by Audere
//
// Use of this source code is governed by an LGPL-3.0 license that
// can be found in the LICENSE file distributed with this file.

import React, { Fragment } from "react";
import { Image, StyleSheet, View } from "react-native";
import { WithNamespaces, withNamespaces } from "react-i18next";
import Text from "./Text";
import { REGULAR_TEXT, GUTTER, CUSTOM_BULLET_OFFSET } from "../styles";

interface Props {
  content: string;
  customBulletUri?: string;
}

export class BulletPoint extends React.PureComponent<Props> {
  render() {
    const { customBulletUri, content } = this.props;
    return (
      <View style={styles.container}>
        {!!customBulletUri ? (
          <Image
            source={{ uri: customBulletUri }}
            style={styles.customBullet}
          />
        ) : (
          <Text content={"\u2022  "} />
        )}
        <Text style={styles.bulletText} content={content} />
      </View>
    );
  }
}

interface BulletProps {
  customBulletUri?: string;
  label?: string;
  namespace: string;
  remoteConfigValues?: { [key: string]: string };
}

class BulletPointsComponent extends React.Component<
  BulletProps & WithNamespaces
> {
  shouldComponentUpdate(props: BulletProps & WithNamespaces) {
    return (
      props.customBulletUri != this.props.customBulletUri ||
      props.label != this.props.label ||
      props.namespace != this.props.namespace
    );
  }

  render() {
    const {
      customBulletUri,
      label,
      namespace,
      remoteConfigValues,
      t,
    } = this.props;

    return (
      <Fragment>
        <View>
          {t(
            namespace + (!!label ? `:${label}` : ":bullets"),
            remoteConfigValues
          )
            .split("\n")
            .map((bullet: string, index: number) => {
              return (
                <BulletPoint
                  key={`bullet-${index}`}
                  content={bullet}
                  customBulletUri={customBulletUri}
                />
              );
            })}
        </View>
      </Fragment>
    );
  }
}
export default withNamespaces()(BulletPointsComponent);

const styles = StyleSheet.create({
  bulletText: {
    flex: 1,
    marginBottom: GUTTER,
  },
  container: {
    flexDirection: "row",
  },
  customBullet: {
    height: REGULAR_TEXT,
    width: REGULAR_TEXT,
    marginRight: GUTTER / 2,
    marginTop: CUSTOM_BULLET_OFFSET,
  },
});
