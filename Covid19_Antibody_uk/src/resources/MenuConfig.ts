// Copyright (c) 2019 by Audere
//
// Use of this source code is governed by an LGPL-3.0 license that
// can be found in the LICENSE file distributed with this file.

import { Component, ScreenConfig } from "../ui/components/Screen";
import BuildInfo from "../ui/components/BuildInfo";
import MainImage from "../ui/components/MainImage";
import ScreenText from "../ui/components/ScreenText";
import CollapsibleText from "../ui/components/CollapsibleText";
import Title from "../ui/components/Title";
import { GUTTER } from "../ui/styles";
import { testSupport, callSupport } from "./LinkConfig";
import Button from "../ui/components/Button";
import { AppEvents } from "../util/tracker";
import { getDevice } from "../transport/DeviceInfo";

function menuScreen(
  key: string,
  hasDesc: boolean = true,
  components: Component[] = []
): ScreenConfig {
  const topSection: Component[] = [
    { tag: MainImage, props: { menuItem: true, uri: "colorlogo" } },
    { tag: Title },
  ];
  const body: Component[] = hasDesc
    ? topSection.concat({ tag: ScreenText, props: { label: "description" } })
    : topSection;

  return {
    body: body.concat(components),
    chromeProps: { menuItem: true },
    key,
  };
}


export const MenuScreens: ScreenConfig[] = [
  menuScreen("ContactSupport", true, [
    {
      tag: Button,
      props: {
        enabled: true,
        primary: true,
        label: "emailSupport",
        onPress: testSupport,
        style: {
          marginVertical: GUTTER,
          alignSelf: "center",
        },
      },
    },
    {
      tag: Button,
      props: {
        enabled: true,
        primary: true,
        label: "callSupport",
        onPress: callSupport,
        style: {
          alignSelf: "center",
        },
      },
    },
  ]),
  menuScreen("Version", true, [{ tag: BuildInfo }]),
];
