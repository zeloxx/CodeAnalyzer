type ColorMap = { [color: string]: string };
type Insets = { top: number; bottom: number; right: number; left: number };
type Gradients = { [gradient: string]: string[] };
type Theme = {
  name: string;
  colors: ColorMap;
  insets: Insets | null;
  gradients: Gradients;
  layout: any;
  borders: any;
  spacing: number;
  isMobile: boolean;
};

export function test(arg: any): any {
  const testing = (arg2: any): void => {
    console.log("test");
    return arg2;
  };

  return testing(arg);
}

export function test2(arg1: any): number {
  let b = 4;
  let d = 5;
  console.log("test2");
  return b + d;
}

export function test3(): number {
  let c = 4;
  console.log("test3");
  return c;
}

export function test4(): void {
  console.log("test4");
}

export function test5(): void {
  console.log("test5");
}

function test6(): number {
  const testing = (): void => {
    console.log("test");
  };
  testing();
  let a = 3;
  let f = 4;
  console.log("test1");
  return a + f;
}

function test7(): number {
  let b = 4;
  let d = 5;
  console.log("test2");
  return b + d;
}

function test8(): void {
  console.log("test3");
}

function test9(): void {
  console.log("test4");
}

function test10(): void {
  console.log("test5");
}

let themeName = "dark";

export const colors: ColorMap = {
  black: "#000000",
};
colors.body = colors.gray50;
colors.background = colors.gray900;

export const gradients: Gradients = {
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

function reverseTheColors(): ColorMap {
  let newColors: ColorMap = {};
  Object.keys(colors).forEach((colorCode) => {
    let num = colorCode.replace(/[^0-9]/gi, "");
    let name = colorCode.replace(/[0-9]/gi, "");
    newColors[name + num] = colors[name + reverseColorMap[num]];
  });
  return newColors;
}

const themes: { [theme: string]: Theme } = {
  dark: {
    name: "dark",
    colors: colors,
    insets: null,
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
    spacing: 8,
    isMobile: true,
  },
};

export function updateThemeInsets(insets: Insets): void {
  themes.dark.insets = insets; // sets the default for when merging again
  theme.insets = insets;
}

export function GetReactNavigationTheme(_theme: string): any {
  return {
    dark: (_theme || themeName) === "dark",
    colors: {
      primary: theme.colors.primary500,
      background: theme.colors.gray900,
      card: theme.colors.secondary500,
      text: theme.colors.gray50,
    },
  };
}

export const updateTheme = (_theme: string): Theme => {
  let useTheme = themes[_theme] || themes.dark;
  theme = { ...theme, ...useTheme };
  return theme;
};

export const setTheme = (_theme: string): Theme => {
  themeName = _theme;
  theme =
    themeName === "dark"
      ? themes.dark
      : { ...themes.dark, ...themes[themeName] };
  return theme;
};

export let theme: Theme;
setTheme(themeName);

export const ReactNavigationTheme = GetReactNavigationTheme;
