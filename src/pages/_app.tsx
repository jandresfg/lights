import { MantineProvider } from "@mantine/core";
import { Notifications } from "@mantine/notifications";
import { type AppType } from "next/dist/shared/lib/utils";

import "~/styles/globals.css";

const MyApp: AppType = ({ Component, pageProps }) => {
  return (
    <MantineProvider withGlobalStyles withNormalizeCSS>
      <Notifications position="top-center" />
      <Component {...pageProps} />
    </MantineProvider>
  );
};

export default MyApp;
