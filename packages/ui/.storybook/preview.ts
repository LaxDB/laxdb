// oxlint-disable-next-line import/no-unassigned-import -- Storybook preview must load global styles for all stories
import "../src/globals.css";

import { withThemeByClassName } from "@storybook/addon-themes";
import type { Preview, Renderer } from "@storybook/react-vite";
import { Agentation } from "agentation";
import { createElement, Fragment } from "react";

const preview: Preview = {
  decorators: [
    (Story) =>
      createElement(
        Fragment,
        null,
        createElement(Story),
        process.env.NODE_ENV === "development"
          ? createElement(Agentation, { endpoint: "http://localhost:4747" })
          : null,
      ),
    withThemeByClassName<Renderer>({
      themes: {
        light: "",
        dark: "dark",
      },
      defaultTheme: "light",
    }),
  ],
};

export default preview;
