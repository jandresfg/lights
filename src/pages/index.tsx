import { ActionIcon, Modal, RingProgress, Slider, Text } from "@mantine/core";
import { useDisclosure, useInterval } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import { type GetServerSideProps, type NextPage } from "next";
import Head from "next/head";
import { useEffect, useMemo, useRef, useState } from "react";
import { ChromePicker, type ColorResult } from "react-color";
import { BiArrowBack } from "react-icons/bi";
import {
  BsLightbulb,
  BsLightbulbOffFill,
  BsPauseFill,
  BsPlayFill,
  BsXLg,
} from "react-icons/bs";
import { FaRandom } from "react-icons/fa";
import { IoMdInformation } from "react-icons/io";
import { MdColorLens } from "react-icons/md";
import { v4 } from "uuid";
import { z } from "zod";
import { env } from "~/env.mjs";

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
    transition_light_state: z.discriminatedUnion("on_off", [
      z.object({
        on_off: z.literal(0),
        err_code: z.number(),
        dft_on_state: lightStateSchema.omit({ on_off: true, err_code: true }),
      }),
      lightStateSchema.merge(z.object({ on_off: z.literal(1) })),
    ]),
  }),
});

export const getLightStateResponseDataSchema = z.object({
  "smartlife.iot.smartbulb.lightingservice": z.object({
    get_light_state: z.discriminatedUnion("on_off", [
      z.object({
        on_off: z.literal(0),
        err_code: z.number(),
        dft_on_state: lightStateSchema.omit({ on_off: true, err_code: true }),
      }),
      lightStateSchema.merge(z.object({ on_off: z.literal(1) })),
    ]),
  }),
});

type PageProps = {
  loginResponse: z.infer<typeof LoginSchema>;
};

const Home: NextPage<PageProps> = ({ loginResponse }) => {
  const [deviceListResponse, setDeviceListResponse] =
    useState<z.infer<typeof deviceListResponseSchema>>();
  const [lamp, setLamp] = useState<z.infer<typeof deviceSchema>>();
  const [latestLightState, setLatestLightState] =
    useState<z.infer<typeof lightStateSchema>>();
  const [changingColor, setChangingColor] = useState(false);
  const [previousFreq, setPreviousFreq] = useState(2000);
  const [autoSwitchFreq, setAutoSwitchFreq] = useState(previousFreq);
  const [remainingSeconds, setRemainingSeconds] = useState(previousFreq);
  const [manuallySelecting, setManuallySelecting] = useState(false);

  const [opened, { open, close }] = useDisclosure(false); // disclosure for info modal

  const handleError = (e: object) => {
    console.error(e);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    notifications.show({
      title: e.toString(),
      message: null,
      color: "red",
      icon: <BsXLg />,
      autoClose: false,
    });
  };

  useEffect(() => {
    if (!loginResponse) return;

    async function getLightBulbId() {
      const payload = { method: "getDeviceList" };
      const url = new URL("https://wap.tplinkcloud.com/");
      url.searchParams.append("token", loginResponse?.result.token);
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
    getLightBulbId().catch(handleError);
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

    getLightState().catch(handleError);
  }, [lamp]);

  const remainingSecondsRef = useRef<number>();

  useEffect(() => {
    remainingSecondsRef.current = remainingSeconds;
  });

  const autoSwitchInterval = useInterval(() => {
    if (remainingSecondsRef.current && remainingSecondsRef.current > 0) {
      setRemainingSeconds((val) => val - 100);
    } else {
      changeColor().catch(handleError);
      setRemainingSeconds(autoSwitchFreq);
    }
  }, 100);

  useEffect(() => {
    if (autoSwitchFreq !== previousFreq) {
      autoSwitchInterval.stop();
      setRemainingSeconds(autoSwitchFreq);
      changeColor().catch(handleError);
      autoSwitchInterval.start();
      setPreviousFreq(autoSwitchFreq);
    }
  }, [autoSwitchFreq]);

  /**
   * @param newState brightness: 0-100, hue: 0-360, saturation: 0-100, color_temp: 2500-9000, on_off: 1 on, 0 off
   */
  async function changeColor(
    newState: Partial<z.infer<typeof lightStateSchema>> = {
      brightness: 50,
      hue: Math.floor(Math.random() * 361),
      saturation: Math.floor(Math.random() * 71) + 30,
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
    url.searchParams.append("token", loginResponse?.result.token);
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

        const on_off =
          updateResponseData["smartlife.iot.smartbulb.lightingservice"]
            .transition_light_state.on_off;

        setLatestLightState(
          on_off
            ? updateResponseData["smartlife.iot.smartbulb.lightingservice"]
                .transition_light_state
            : {
                ...updateResponseData["smartlife.iot.smartbulb.lightingservice"]
                  .transition_light_state.dft_on_state,
                on_off,
                err_code:
                  updateResponseData["smartlife.iot.smartbulb.lightingservice"]
                    .transition_light_state.err_code,
              }
        );
      });
  }

  async function getLightState() {
    const payload = {
      method: "passthrough",
      params: {
        deviceId: lamp?.deviceId,
        requestData: JSON.stringify({
          "smartlife.iot.smartbulb.lightingservice": {
            get_light_state: {},
          },
        }),
      },
    };
    const url = new URL("https://wap.tplinkcloud.com/");
    url.searchParams.append("token", loginResponse?.result.token);
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
        const getLightStateResponseData = getLightStateResponseDataSchema.parse(
          JSON.parse(response.result.responseData)
        );

        const on_off =
          getLightStateResponseData["smartlife.iot.smartbulb.lightingservice"]
            .get_light_state.on_off;

        setLatestLightState(
          on_off
            ? getLightStateResponseData[
                "smartlife.iot.smartbulb.lightingservice"
              ].get_light_state
            : {
                ...getLightStateResponseData[
                  "smartlife.iot.smartbulb.lightingservice"
                ].get_light_state.dft_on_state,
                on_off,
                err_code:
                  getLightStateResponseData[
                    "smartlife.iot.smartbulb.lightingservice"
                  ].get_light_state.err_code,
              }
        );
      });
  }

  const hslString = useMemo(
    () =>
      latestLightState && latestLightState.on_off
        ? `hsl(${latestLightState.hue} ${latestLightState.saturation}% ${latestLightState.brightness}%)`
        : "hsl(280 100% 70%)",
    [latestLightState]
  );

  const gradientString = useMemo(
    () =>
      latestLightState && latestLightState.on_off
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
      <main
        className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-[#2e026d] to-[#15162c]"
        style={{ backgroundImage: gradientString }}
      >
        <div className="container flex flex-col items-center justify-center gap-12 px-4 py-16 ">
          <h1 className="text-5xl font-extrabold tracking-tight text-white sm:text-[5rem]">
            <span
              style={{
                color: hslString,
              }}
            >
              Lights
            </span>
          </h1>

          {/* "loading..." subtitle */}
          {!lamp && (
            <h2>
              <span
                style={{
                  color: hslString,
                }}
              >
                Connecting...
              </span>
            </h2>
          )}

          {/* manual select button */}
          {latestLightState?.on_off === 1 && !autoSwitchInterval.active && (
            <ActionIcon
              size="xl"
              radius="xl"
              variant="outline"
              style={{
                color: hslString,
              }}
              onClick={() => {
                setManuallySelecting((prev) => !prev);
              }}
            >
              {manuallySelecting ? (
                <BiArrowBack size="1.7rem" title="go back" />
              ) : (
                <MdColorLens size="1.7rem" title="select color" />
              )}
            </ActionIcon>
          )}

          {/* manual select color picker */}
          {manuallySelecting && (
            <ChromePicker
              color={{
                h: Number(latestLightState?.hue),
                s: Number(latestLightState?.saturation) / 100,
                l: Number(latestLightState?.brightness) / 100,
              }}
              onChangeComplete={(color: ColorResult) => {
                changeColor({
                  hue: Math.floor(color.hsl.h),
                  saturation: Math.floor(color.hsl.s * 100),
                  brightness: Math.floor(color.hsl.l * 100),
                  on_off: 1,
                }).catch(handleError);
              }}
              disableAlpha
            />
          )}

          {/* random button */}
          {latestLightState?.on_off === 1 && !autoSwitchInterval.active && (
            <ActionIcon
              size="xl"
              radius="xl"
              variant="outline"
              style={{
                color: hslString,
              }}
              onClick={() => {
                setChangingColor(true);
                changeColor()
                  .catch(handleError)
                  .finally(() => {
                    setChangingColor(false);
                  });
              }}
              disabled={changingColor}
            >
              <FaRandom size="1.7rem" title="random color" />
            </ActionIcon>
          )}

          {/* play/pause button */}
          {lamp && !manuallySelecting && (
            <ActionIcon
              size="xl"
              radius="xl"
              variant="outline"
              style={{
                color: hslString,
              }}
              onClick={() => {
                if (!autoSwitchInterval.active) {
                  changeColor().catch(handleError);
                }
                autoSwitchInterval.toggle();
              }}
            >
              {autoSwitchInterval.active ? (
                <BsPauseFill size="1.7rem" title="stop auto-switch" />
              ) : (
                <BsPlayFill size="1.7rem" title="start auto-switch" />
              )}
            </ActionIcon>
          )}

          {/* auto-switch frequency slider */}
          {autoSwitchInterval.active && (
            <>
              <Slider
                min={2}
                max={10}
                step={0.5}
                value={autoSwitchFreq / 1000}
                onChangeEnd={(value) => {
                  setAutoSwitchFreq(value * 1000);
                }}
                label={(value) => `${value} s`}
                style={{ width: "inherit" }}
                thumbSize={20}
                styles={() => ({
                  bar: {
                    backgroundColor: hslString,
                  },
                  thumb: {
                    borderColor: hslString,
                  },
                  markFilled: {
                    borderColor: hslString,
                    backgroundColor: "white",
                  },
                  mark: {
                    backgroundColor: hslString,
                  },
                })}
                marks={[
                  { value: 2, label: "2 s" },
                  { value: 2.5 },
                  { value: 3, label: "3 s" },
                  { value: 3.5 },
                  { value: 4, label: "4 s" },
                  { value: 4.5 },
                  { value: 5, label: "5 s" },
                  { value: 5.5 },
                  { value: 6, label: "6 s" },
                  { value: 6.5 },
                  { value: 7, label: "7 s" },
                  { value: 7.5 },
                  { value: 8, label: "8 s" },
                  { value: 8.5 },
                  { value: 9, label: "9 s" },
                  { value: 9.5 },
                  { value: 10, label: "10 s" },
                ]}
              />
              <RingProgress
                sections={[
                  {
                    value:
                      100 -
                      Math.floor((remainingSeconds / autoSwitchFreq) * 100),
                    color: hslString,
                  },
                ]}
                label={
                  <Text color={hslString} weight={700} align="center" size="xl">
                    {(autoSwitchFreq - remainingSeconds) / 1000} s
                  </Text>
                }
                roundCaps
              />
            </>
          )}

          {/* on/off button */}
          {lamp && !autoSwitchInterval.active && !manuallySelecting && (
            <ActionIcon
              size="xl"
              radius="xl"
              variant="outline"
              style={{
                color: hslString,
              }}
              onClick={() => {
                setChangingColor(true);
                const newValue = latestLightState?.on_off ? 0 : 1;
                changeColor({ ...latestLightState, on_off: newValue })
                  .catch(handleError)
                  .finally(() => {
                    setChangingColor(false);
                  });
              }}
              disabled={changingColor}
            >
              {latestLightState?.on_off ? (
                <BsLightbulbOffFill size="1.7rem" title="turn off" />
              ) : (
                <BsLightbulb size="1.7rem" title="turn on" />
              )}
            </ActionIcon>
          )}

          {/* info button and modal */}
          {lamp && (
            <>
              <ActionIcon
                size="xl"
                radius="xl"
                variant="outline"
                style={{
                  color: hslString,
                }}
                onClick={open}
              >
                <IoMdInformation size="1.7rem" title="info" />
              </ActionIcon>
              <Modal
                opened={opened}
                onClose={close}
                centered
                withCloseButton={false}
              >
                <pre
                  style={{
                    color: hslString,
                  }}
                >
                  {JSON.stringify(lamp, null, 3)}
                </pre>
                <pre
                  style={{
                    color: hslString,
                  }}
                >
                  {JSON.stringify(latestLightState, null, 3)}
                </pre>
              </Modal>
            </>
          )}
        </div>
      </main>
    </>
  );
};

export const getServerSideProps: GetServerSideProps<PageProps> = async (
  context
) => {
  const payload = {
    method: "login",
    params: {
      appType: "Kasa_Android",
      cloudUserName: env.TPLINK_USER,
      cloudPassword: env.TPLINK_PASSWORD,
      terminalUUID: v4(),
    },
  };
  const loginResponse = await fetch("https://wap.tplinkcloud.com/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  })
    .then((response) => response.json())
    .then((data) => LoginSchema.parse(data));
  return {
    props: { loginResponse }, // will be passed to the page component as props
  };
};

export default Home;
