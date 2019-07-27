import React from "react";
import { PermissionsAndroid, StyleSheet, View } from "react-native";
import { WithNamespaces, withNamespaces } from "react-i18next";
import { connect } from "react-redux";
import { viewDetails, Action, StoreState } from "../store";
import Text from "./components/Text";
import Title from "./components/Title";
import { GUTTER } from "./styles";

interface Props {
  currentPatient: number;
  dispatch(action: Action): void;
}

class LocationPermissionRequired extends React.Component<
  Props & WithNamespaces
> {
  async componentDidMount() {
    await this.requestLocationPermission();
  }

  async requestLocationPermission() {
    const { t } = this.props;
    try {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        {
          title: t("alertTitle"),
          message: t("alertMsg"),
          buttonNegative: t("common:cancel"),
          buttonPositive: t("common:ok")
        }
      );
      if (granted === PermissionsAndroid.RESULTS.GRANTED) {
        this.props.dispatch(viewDetails(this.props.currentPatient));
      }
    } catch (err) {
      console.warn(err);
    }
  }

  render() {
    const { t } = this.props;
    return (
      <View style={styles.container}>
        <Title label={t("title")} />
        <Text content={t("why")} />
        <Text content={t("howToUpdate")} />
        <Text content={t("whereUpdate")} />
        <Text content={t("howUpdate")} />
      </View>
    );
  }
}

export default connect((state: StoreState, props: Props) => ({
  currentPatient: state.meta.currentPatient
}))(withNamespaces("locationPermissions")(LocationPermissionRequired));

const styles = StyleSheet.create({
  container: {
    alignSelf: "stretch",
    flex: 1,
    margin: GUTTER
  }
});
