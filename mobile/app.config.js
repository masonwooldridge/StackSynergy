module.exports = ({ config }) => {
  const allowHttp = process.env.CARDCHASM_ALLOW_HTTP === "1";
  return {
    ...config,
    ios: {
      ...config.ios,
      infoPlist: {
        ...config.ios?.infoPlist,
        NSLocalNetworkUsageDescription:
          "Connect to your CardChasm server on your Wi-Fi network.",
        ...(allowHttp
          ? { NSAppTransportSecurity: { NSAllowsArbitraryLoads: true } }
          : {}),
      },
    },
    plugins: [
      ...(config.plugins || []),
      [
        "expo-build-properties",
        { android: { usesCleartextTraffic: allowHttp } },
      ],
    ],
  };
};
