import { ActionIcon } from "@mantine/core";
import { type NextPage } from "next";
import Head from "next/head";
import { useEffect, useMemo, useState } from "react";
import { BsLightbulb, BsLightbulbOffFill } from "react-icons/bs";
import { FaRandom } from "react-icons/fa";
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
  const [changingColor, setChangingColor] = useState(false);

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

  /**
   * @param newState brightness: 0-100, hue: 0-360, saturation: 0-100, color_temp: 2500-9000, on_off: 1 on, 0 off
   */
  async function changeColor(
    newState: Partial<z.infer<typeof lightStateSchema>> = {
      brightness: 50,
      hue: Math.floor(Math.random() * 361),
      saturation: Math.floor(Math.random() * 101),
      color_temp: 0,
      on_off: 1,
    }
  ) {
    const payload = {
      method: "passthrough",
      params: {
        deviceId: lamp?.deviceId,
        requestData: JSON.stringify({
          "smartlife.iot.smartbulb.lightingservice": {
            transition_light_state: newState,
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
        // if on_off is 0 the response schema changes
        if (newState.on_off === 0) {
          setLatestLightState((curr) => ({ ...curr!, on_off: 0 }));
          return;
        }
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

  const hslString = useMemo(
    () =>
      latestLightState
        ? `hsl(${latestLightState.hue} ${latestLightState.saturation}% ${latestLightState.brightness}%)`
        : "hsl(280 100% 70%)",
    [latestLightState]
  );

  const gradientString = useMemo(
    () =>
      latestLightState
        ? `linear-gradient(to bottom, hsl(${latestLightState.hue} ${
            latestLightState.saturation
          }% ${Math.floor(latestLightState.brightness * 0.8)}%), hsl(${
            latestLightState.hue
          } ${latestLightState.saturation}% 10%))`
        : "linear-gradient(to bottom, #2e026d, #15162c)",
    [latestLightState]
  );

  return (
    <>
      <Head>
        <title>Lights</title>
        <meta name="description" content="Generated by create-t3-app" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <main className={styles.main} style={{ backgroundImage: gradientString }}>
        <div className={styles.container}>
          <h1 className={styles.title}>
            <span
              style={{
                color: hslString,
              }}
            >
              Lights
            </span>
          </h1>
          <h2>
            <span
              style={{
                color: hslString,
              }}
            >
              {lamp ? `Connected to ${lamp.alias}` : "Loading..."}
            </span>
          </h2>
          <ActionIcon
            size="xl"
            radius="xl"
            variant="outline"
            style={{
              color: hslString,
            }}
            onClick={() => {
              if (lamp) {
                setChangingColor(true);
                changeColor()
                  .catch((e) => console.error(e))
                  .finally(() => {
                    setChangingColor(false);
                  });
              }
            }}
            disabled={changingColor}
          >
            <FaRandom size="1.7rem" title="random color" />
          </ActionIcon>
          <ActionIcon
            size="xl"
            radius="xl"
            variant="outline"
            style={{
              color: hslString,
            }}
            onClick={() => {
              if (lamp) {
                setChangingColor(true);
                const newValue = latestLightState?.on_off ? 0 : 1;
                changeColor({ ...latestLightState, on_off: newValue })
                  .catch((e) => console.error(e))
                  .finally(() => {
                    setChangingColor(false);
                  });
              }
            }}
            disabled={changingColor}
          >
            {latestLightState?.on_off ? (
              <BsLightbulbOffFill size="1.7rem" title="turn off" />
            ) : (
              <BsLightbulb size="1.7rem" title="turn on" />
            )}
          </ActionIcon>
          {/* <pre
            style={{
              color: hslString,
            }}
          >
            {JSON.stringify(latestLightState, null, 3)}
          </pre> */}
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
