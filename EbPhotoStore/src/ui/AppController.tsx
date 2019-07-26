import React, { Fragment } from "react";
import { BackHandler, Text, View } from "react-native";
import { connect } from "react-redux";
import {
  logout,
  viewPatients,
  viewDetails,
  Action,
  Screen,
  StoreState
} from "../store";
import Login from "./Login";
import Patients from "./Patients";
import Details from "./Details";
import CameraPermissionRequired from "./CameraPermissionRequired";
import LocationPermissionRequired from "./LocationPermissionRequired";
import PhotoCapture from "./PhotoCapture";
import TitleBar from "./components/TitleBar";

interface Props {
  currentPatient?: number;
  screen: Screen;
  dispatch(action: Action): void;
}

class AppController extends React.Component<Props> {
  _backHandler: any;

  componentDidMount() {
    this._backHandler = BackHandler.addEventListener(
      "hardwareBackPress",
      this._handleBackPress
    );
  }

  componentWillUnmount() {
    if (this._backHandler != null) {
      this._backHandler.remove();
    }
  }

  _handleBackPress = () => {
    switch (this.props.screen) {
      case Screen.Patients:
        this.props.dispatch(logout());
        return true;
      case Screen.PatientDetails:
        this.props.dispatch(viewPatients());
        return true;
      case Screen.Camera:
        this.props.dispatch(viewDetails(this.props.currentPatient!));
        return true;
      case Screen.LocationPermission:
        this.props.dispatch(viewPatients());
        return true;
      case Screen.CameraPermission:
        this.props.dispatch(viewDetails(this.props.currentPatient!));
        return true;
    }
    return false;
  };

  _getScreen = () => {
    switch (this.props.screen) {
      case Screen.Login:
        return <Login />;
      case Screen.Patients:
        return <Patients />;
      case Screen.PatientDetails:
        return <Details id={this.props.currentPatient} />;
      case Screen.Camera:
        return <PhotoCapture id={this.props.currentPatient} />;
      case Screen.LocationPermission:
        return <LocationPermissionRequired />;
      case Screen.CameraPermission:
        return <CameraPermissionRequired />;
    }
  };

  render() {
    return (
      <Fragment>
        <TitleBar />
        {this._getScreen()}
      </Fragment>
    );
  }
}
export default connect((state: StoreState) => ({
  currentPatient: state.meta.currentPatient,
  screen: state.meta.screen
}))(AppController);
