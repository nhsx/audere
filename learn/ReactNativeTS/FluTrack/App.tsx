import "./src/hacks";
import React from "react";
import {
  createDrawerNavigator,
  createStackNavigator,
  NavigationScreenProp,
} from "react-navigation";
import AccountScreen from "./src/ui/screens/AccountScreen";
import ComponentLibraryScreen from "./src/ui/screens/ComponentLibraryScreen";
import LoginScreen from "./src/ui/screens/LoginScreen";
import ScreeningScreen from "./src/ui/screens/ScreeningScreen";
import SymptomsScreen from "./src/ui/screens/SymptomsScreen";
import DemographicsScreen from "./src/ui/screens/DemographicsScreen";
import HouseholdScreen from "./src/ui/screens/HouseholdScreen";
import IllnessHistoryScreen from "./src/ui/screens/IllnessHistoryScreen";
import ConsentScreen from "./src/ui/screens/ConsentScreen";
import AboutScreen from "./src/ui/screens/AboutScreen";
import { store, persistor, StoreState } from "./src/store/";
import { Provider, connect } from "react-redux";
import { PersistGate } from "redux-persist/integration/react";
import { I18nextProvider, withNamespaces } from "react-i18next";
import { createUploader } from "./src/transport";
import i18n from "./src/i18n";

import HomeScreen from './src/ui/screens/experiment/HomeScreen';
import WelcomeScreen from './src/ui/screens/experiment/WelcomeScreen';
import AgeScreen from './src/ui/screens/experiment/AgeScreen';
import SymptomsScreen2 from './src/ui/screens/experiment/SymptomsScreen';
import SwabScreen from './src/ui/screens/experiment/SwabScreen';
import BloodScreen from './src/ui/screens/experiment/BloodScreen';
import ConsentScreen2 from './src/ui/screens/experiment/ConsentScreen';
import EnrolledScreen from './src/ui/screens/experiment/EnrolledScreen';
import InelligibleScreen from './src/ui/screens/experiment/InelligibleScreen';
import HeaderBar from './src/ui/screens/experiment/components/HeaderBar';
import SurveyStartScreen from './src/ui/screens/experiment/SurveyStartScreen';
import SurveyScreen from './src/ui/screens/experiment/SurveyScreen';

const uploader = createUploader();
export function interact(data: string): void {
  console.warn("Use uploader.save() instead of App.interact()");
  uploader.save("remove-me", { data });
}

const routes = {
  Account: AccountScreen,
  Screening: ScreeningScreen,
  Symptoms: SymptomsScreen,
  Demographics: DemographicsScreen,
  Household: HouseholdScreen,
  IllnessHistory: IllnessHistoryScreen,
  Consent: ConsentScreen,
};

export function goToNextScreen(navigation: NavigationScreenProp<any, any>) {
  const currentRoute = navigation.state.routeName;
  const routeNames = Object.keys(routes);
  const currentRouteIndex = routeNames.indexOf(currentRoute);
  if (currentRouteIndex > -1 && currentRouteIndex < routeNames.length - 1) {
    const nextRoute = routeNames[currentRouteIndex + 1];
    navigation.navigate(nextRoute);
  }
}

const ExperimentStack = createStackNavigator({
  Home: {
    screen: HomeScreen,
    navigationOptions: {
      header: null,
    },
  },
  Welcome: WelcomeScreen,
  Age: AgeScreen,
  Symptoms: SymptomsScreen2,
  Swab: SwabScreen,
  Blood: BloodScreen,
  Consent: ConsentScreen2,
  Inelligible: InelligibleScreen,
  Enrolled: EnrolledScreen,
  SurveyStart: SurveyStartScreen,
  Survey: SurveyScreen,
}, {
  mode: 'modal',
  headerMode: 'float',
  navigationOptions: ({ navigation }) => ({
    header: <HeaderBar navigation={ navigation } />,
  }),
});

const MainStack = createStackNavigator(routes);
const LoginStack = createStackNavigator({ Login: LoginScreen });
const Drawer = createDrawerNavigator({
  Main: { screen: MainStack },
  ComponentLibrary: { screen: ComponentLibraryScreen },
  About: { screen: AboutScreen },
  ExperimentStack,
});

const Root = connect((state: StoreState) => ({
  isLoggedIn: state.user !== null,
}))(
  (props: { isLoggedIn: boolean }) =>
    props.isLoggedIn ? (
      <Drawer screenProps={{ t: i18n.getFixedT(), uploader: createUploader() }} />
    ) : (
      <LoginStack screenProps={{ t: i18n.getFixedT() }} />
    )
);

const ReloadAppOnLanguageChange = withNamespaces("common")(Root);

export default class App extends React.Component {
  render() {
    return (
      <I18nextProvider i18n={i18n}>
        <Provider store={store}>
          <PersistGate loading={null} persistor={persistor}>
            <ReloadAppOnLanguageChange />
          </PersistGate>
        </Provider>
      </I18nextProvider>
    );
  }
}
