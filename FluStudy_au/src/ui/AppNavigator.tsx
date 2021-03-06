// Copyright (c) 2019 by Audere
//
// Use of this source code is governed by an LGPL-3.0 license that
// can be found in the LICENSE file distributed with this file.

import React from "react";
import { Platform } from "react-native";
import {
  NavigationAction,
  NavigationActions,
  NavigationState,
  StackActions,
  createDrawerNavigator,
  createStackNavigator,
} from "react-navigation";
import { uploadingErrorHandler } from "../util/uploadingErrorHandler";
import { Menu } from "./components/Menu";
import { createMenuScreens } from "../resources/MenuConfig";
import { Screens } from "../resources/ScreenConfig";
import { generateScreen } from "./components/Screen";

const homeRouteConfig = Screens.reduce(
  (homeRouteConfig, config) => ({
    ...homeRouteConfig,
    [config.key]: {
      screen: generateScreen(config),
    },
  }),
  {}
);

const Home = createStackNavigator(homeRouteConfig, {
  initialRouteName: "Welcome",
  // @ts-ignore
  defaultNavigationOptions: {
    gesturesEnabled: false,
  },
  headerMode: "none",
});

export const getActiveRouteName = (
  navigationState: NavigationState
): string | null => {
  if (!navigationState) {
    return null;
  }
  try {
    const route = navigationState.routes[navigationState.index];
    // dive into nested navigators
    if (route.routes) {
      // @ts-ignore
      return getActiveRouteName(route);
    }
    return route.routeName;
  } catch (e) {
    uploadingErrorHandler(e, true, "NavigationState corrupted");
    return null;
  }
};

const withNavigationPreventDuplicate = (getStateForAction: any) => {
  const defaultGetStateForAction = getStateForAction;
  const getStateForActionWithoutDuplicates = (
    action: NavigationAction,
    state: NavigationState
  ) => {
    if (
      action.type === NavigationActions.NAVIGATE ||
      action.type === StackActions.PUSH
    ) {
      // Note: this is fine for now because we don't ever navigate to the same screen with different parameters,
      // but if we did, we'd want to do a deep comparison of the route.params
      const currentRouteName = getActiveRouteName(state);
      if (currentRouteName === action.routeName) {
        return null;
      }
    }

    return defaultGetStateForAction(action, state);
  };
  return getStateForActionWithoutDuplicates;
};

Home.router.getStateForAction = withNavigationPreventDuplicate(
  Home.router.getStateForAction
);

function createRouteConfig() {
  return createMenuScreens().reduce(
    (routeConfig, config) => ({
      ...routeConfig,
      [config.key]: { screen: generateScreen(config) },
    }),
    { Home }
  );
}

export default function createAppNavigator() {
  return createDrawerNavigator(createRouteConfig(), {
    contentComponent: Menu,
    drawerPosition: "right",
    // @ts-ignore
    useNativeAnimations: Platform.OS === "ios", // Can't use on Android
    drawerLockMode: "locked-open",
  });
}
