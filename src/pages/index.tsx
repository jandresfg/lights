import { type NextPage } from "next";
import Head from "next/head";
import { useEffect, useState } from "react";
import { v4 } from "uuid";
import { z } from "zod";
import { env } from "~/env.mjs";
import styles from "./index.module.css";

export const LoginSchema = z.object({
  error_code: z.number(),
  result: z.object({
    accountId: z.string(),
    regTime: z.string(),
    countryCode: z.string(),
    riskDetected: z.number(),
    email: z.string(),
    token: z.string(),
  }),
});

export const deviceSchema = z.object({
  deviceType: z.string(),
  role: z.number(),
  fwVer: z.string(),
  appServerUrl: z.string(),
  deviceRegion: z.string(),
  deviceId: z.string(),
  deviceName: z.string(),
  deviceHwVer: z.string(),
  alias: z.string(),
  deviceMac: z.string(),
  oemId: z.string(),
  deviceModel: z.string(),
  hwId: z.string(),
  fwId: z.string(),
  isSameRegion: z.boolean(),
  status: z.number(),
});

export const deviceListResponseSchema = z.object({
  error_code: z.number(),
  result: z.object({
    deviceList: z.array(deviceSchema),
  }),
});

export const updateResponseSchema = z.object({
  error_code: z.number(),
  result: z.object({ responseData: z.string() }),
});

export const lightStateSchema = z.object({
  on_off: z.number(),
  mode: z.string(),
  hue: z.number(),
  saturation: z.number(),
  color_temp: z.number(),
  brightness: z.number(),
  err_code: z.number(),
});

export const updateResponseDataSchema = z.object({
  "smartlife.iot.smartbulb.lightingservice": z.object({
    transition_light_state: lightStateSchema,
  }),
});

const Home: NextPage = () => {
  const [loginResponse, setLoginResponse] =
    useState<z.infer<typeof LoginSchema>>();
  const [deviceListResponse, setDeviceListResponse] =
    useState<z.infer<typeof deviceListResponseSchema>>();
  const [lamp, setLamp] = useState<z.infer<typeof deviceSchema>>();
  const [latestLightState, setLatestLightState] =
    useState<z.infer<typeof lightStateSchema>>();

  useEffect(() => {
    async function login() {
      const payload = {
        method: "login",
        params: {
          appType: "Kasa_Android",
          cloudUserName: env.NEXT_PUBLIC_TPLINK_USER,
          cloudPassword: env.NEXT_PUBLIC_TPLINK_PASSWORD,
          terminalUUID: v4(),
        },
      };
      await fetch("https://wap.tplinkcloud.com/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      })
        .then((response) => response.json())
        .then((data) => {
          setLoginResponse(LoginSchema.parse(data));
        });
    }
    login().catch((e) => console.error(e));
  }, []);

  useEffect(() => {
    if (!loginResponse) return;

    async function getLightBulbId() {
      const payload = { method: "getDeviceList" };
      const url = new URL("https://wap.tplinkcloud.com/");
      url.searchParams.append("token", loginResponse?.result.token as string);
      await fetch(url.href, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      })
        .then((response) => response.json())
        .then((data) => {
          setDeviceListResponse(deviceListResponseSchema.parse(data));
        });
    }
    getLightBulbId().catch((e) => console.error(e));
  }, [loginResponse]);

  useEffect(() => {
    if (!deviceListResponse) return;

    const lamp = deviceListResponse.result.deviceList.find(
      (d) => d.deviceName === "Smart Wi-Fi LED Bulb with Color Changing"
    );
    setLamp(lamp);
  }, [deviceListResponse]);

  useEffect(() => {
    if (!lamp) return;
    if (!loginResponse) return;

    async function changeColor() {
      const payload = {
        method: "passthrough",
        params: {
          deviceId: lamp?.deviceId,
          requestData: JSON.stringify({
            "smartlife.iot.smartbulb.lightingservice": {
              transition_light_state: {
                // See HSB in http://colorizer.org/
                // brightness: 0-100
                // hue: 0-360
                // saturation: 0-100,
                // color_temp: 2500-9000
                // on_off: 1 on, 0 off
                brightness: 43,
                hue: 116,
                saturation: 51,
                color_temp: 9000,
                on_off: 1,
              },
            },
          }),
        },
      };
      const url = new URL("https://wap.tplinkcloud.com/");
      url.searchParams.append("token", loginResponse?.result.token as string);
      await fetch(url.href, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      })
        .then((response) => response.json())
        .then((data) => {
          const response = updateResponseSchema.parse(data);
          const updateResponseData = updateResponseDataSchema.parse(
            JSON.parse(response.result.responseData)
          );
          setLatestLightState(
            updateResponseData["smartlife.iot.smartbulb.lightingservice"]
              .transition_light_state
          );
        });
    }

    changeColor().catch((e) => console.error(e));
  }, [lamp, loginResponse]);

  return (
    <>
      <Head>
        <title>Lights</title>
        <meta name="description" content="Generated by create-t3-app" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <main className={styles.main}>
        <div className={styles.container}>
          <h1 className={styles.title}>
            <span className={styles.pinkSpan}>Lights</span>
          </h1>
          <h3>
            <span className={styles.pinkSpan}>
              {lamp ? `Connected to ${lamp.alias}` : "Loading..."}
            </span>
          </h3>
          <pre className={styles.pinkSpan}>{JSON.stringify(lamp, null, 3)}</pre>
          <div className={styles.cardRow}>
            {/* <Link
              className={styles.card}
              href="https://create.t3.gg/en/usage/first-steps"
              target="_blank"
            >
              <h3 className={styles.cardTitle}>First Steps →</h3>
              <div className={styles.cardText}>
                Just the basics - Everything you need to know to set up your
                database and authentication.
              </div>
            </Link>
            <Link
              className={styles.card}
              href="https://create.t3.gg/en/introduction"
              target="_blank"
            >
              <h3 className={styles.cardTitle}>Documentation →</h3>
              <div className={styles.cardText}>
                Learn more about Create T3 App, the libraries it uses, and how
                to deploy it.
              </div>
            </Link> */}
          </div>
        </div>
      </main>
    </>
  );
};

export default Home;
