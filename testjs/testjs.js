export function test(arg) {
  const testing = (arg2) => {
    console.log("test");
  };
  return testing();
}

export function test2(arg1) {
  var b = 4;
  var d = 5;
  console.log("test2");
  return b + d;
}

export function test3() {
  var c = 4;
  console.log("test3");
  return c;
}

export function test4() {
  console.log("test4");
}

export function test5() {
  console.log("test5");
}

function test6() {
  const testing = () => {
    console.log("test");
  };
  testing();
  var a = 3;
  var f = 4;
  console.log("test1");
  return a + f;
}

function test7() {
  var b = 4;
  var d = 5;
  console.log("test2");
  return b + d;
}

function test8() {
  console.log("test3");
}

function test9() {
  console.log("test4");
}

function test10() {
  console.log("test5");
}

import { initialWindowMetrics } from "react-native-safe-area-context";
let themeName = "dark";

//refer to figma to fill these in:
// https://www.figma.com/file/dzzJqut0WAvsIvXpLEyekF/LunarCRUSH-Design-System?node-id=138%3A0
export const colors = {
  black: "#000000",
};
colors.body = colors.gray50;
colors.background = colors.gray900;

export const gradients = {
  dashboard: ["rgba(245, 250, 250, 0.02)", "rgba(245, 250, 250, 0.01) 99.06%)"],
};
gradients.default = gradients.blue;

const reverseColorMap = {
  50: "900",
  100: "800",
  200: "700",
  300: "600",
  400: "500",
  500: "400",
  600: "300",
  700: "200",
  800: "100",
  900: "50",
};
function reverseTheColors() {
  let newColors = {};
  Object.keys(colors).forEach((colorCode) => {
    let num = colorCode.replace(/[^0-9]/gi, "");
    let name = colorCode.replace(/[0-9]/gi, "");
    newColors[name + num] = colors[name + reverseColorMap[num]];
  });
  return newColors;
}

const themes = {
  dark: {
    name: "dark",
    colors: colors,
    insets:
      initialWindowMetrics && initialWindowMetrics.insets
        ? initialWindowMetrics.insets
        : { top: 0, bottom: 0, right: 0, left: 0 },
    gradients,
    layout: {
      headerHeight: 60,
      headerHeightDesktop: 88,
      headerHeightDesktopAd: 48,
      bottomMenuHeight: 60,
    },
    borders: {
      common: {
        size: 1,
        color: "#2D3131",
      },
    },
    /* our spacing system uses an 8 pixel grid by default
      please use this variable in multiples e.g. if design wants 24 its theme.spacing * 3
      */
    spacing: 8,
    isMobile: true,
  },

  // ONLY IF DIFFERENT THAN DARK
  light: {
    name: "light",
    colors: {
      ...reverseTheColors(),
      ...{
        body: colors.gray800,
        background: colors.gray50,
      },
    },
    borders: {
      common: {
        color: colors.gray700,
      },
    },
  },
};

export function updateThemeInsets(insets) {
  themes.dark.insets = insets; // sets the default for when merging again
  theme.insets = insets;
}

export function GetReactNavigationTheme(_theme) {
  // exports an object to set the default styles for react native/cards/pages
  // https://reactnavigation.org/docs/themes#basic-usage
  //

  return {
    dark: (_theme || themeName) === "dark",
    colors: {
      primary: theme.colors.primary500,
      background: theme.colors.gray900,
      card: theme.colors.secondary500,
      text: theme.colors.gray50,
      border: theme.gray500,
      notification: theme.success500,
    },
  };
}

export const updateTheme = (_theme) => {
  let useTheme = themes[_theme] || themes.dark;
  theme = { ...theme, ...useTheme };
  return theme;
};
export const setTheme = (_theme) => {
  themeName = _theme;
  theme =
    themeName === "dark"
      ? themes.dark
      : { ...themes.dark, ...themes[themeName] };
  //
  return theme;
};

export let theme;
setTheme(themeName);

export const ReactNavigationTheme = GetReactNavigationTheme;
