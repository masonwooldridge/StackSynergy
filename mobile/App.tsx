import { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import * as ImagePicker from "expo-image-picker";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { WebView } from "react-native-webview";
import { useFocusEffect } from "expo-router";
import {
  MAX_BRIDGE_BYTES,
  parseNativeExport,
  serverOrigin,
} from "../shared/nativeBridge";

export default function CardChasmMobile() {
  const [address, setAddress] = useState(
    process.env.EXPO_PUBLIC_CARDCHASM_URL || "http://localhost:3001",
  );
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [canGoBack, setCanGoBack] = useState(false);
  const [picking, setPicking] = useState(false);
  const web = useRef<WebView>(null);
  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener("hardwareBackPress", () => {
        if (canGoBack) {
          web.current?.goBack();
          return true;
        }
        if (url) {
          setUrl(null);
          return true;
        }
        return false;
      });
      return () => sub.remove();
    }, [canGoBack, url]),
  );
  async function connect() {
    try {
      const origin = serverOrigin(address);
      setError("");
      // Browser preview opens the server directly; native fetch has no browser CORS boundary.
      if (Platform.OS === "web") {
        setUrl(origin);
        return;
      }
      const res = await fetch(origin + "/api/me", {
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) throw Error("Server is not ready.");
      const me = await res.json();
      if (!("user" in me))
        throw Error("This address is not a CardChasm server.");
      setLoaded(false);
      setUrl(origin);
    } catch (e) {
      setError(
        `${(e as Error).message} On a phone use your computer’s Wi-Fi address, not localhost.`,
      );
    }
  }
  async function scan(camera: boolean) {
    if (!loaded || picking) return;
    setPicking(true);
    try {
      if (camera) {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) {
          Alert.alert(
            "Camera permission needed",
            "Allow camera access in device Settings, or choose a photo instead.",
          );
          return;
        }
      }
      const options: ImagePicker.ImagePickerOptions = {
        mediaTypes: ["images"],
        base64: true,
        quality: 0.85,
        allowsEditing: false,
      };
      const result = camera
        ? await ImagePicker.launchCameraAsync(options)
        : await ImagePicker.launchImageLibraryAsync(options);
      if (result.canceled) return;
      const base64 = result.assets[0].base64;
      if (!base64)
        throw Error("This photo could not be read. Choose a JPEG or PNG.");
      const payload = JSON.stringify({
        type: "cardchasm:scan",
        id: `${Date.now()}-${Math.random()}`,
        image: "data:image/jpeg;base64," + base64,
      });
      if (payload.length > MAX_BRIDGE_BYTES)
        throw Error("Photo is too large. Choose a smaller image (under 9 MB).");
      web.current?.postMessage(payload);
    } catch (e) {
      Alert.alert("Photo unavailable", (e as Error).message);
    } finally {
      setPicking(false);
    }
  }
  async function share(raw: string) {
    const exported = parseNativeExport(raw);
    if (!exported) return;
    try {
      if (!(await Sharing.isAvailableAsync()))
        throw Error("Sharing is unavailable on this device.");
      const file = new File(Paths.cache, exported.name);
      file.create({ overwrite: true });
      file.write(exported.text);
      await Sharing.shareAsync(file.uri, {
        mimeType: exported.mime,
        dialogTitle: "Export from CardChasm",
      });
    } catch (e) {
      Alert.alert("Export unavailable", (e as Error).message);
    }
  }
  if (!url)
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style="light" />
        <View style={styles.setup}>
          <Text style={styles.brand}>◈ CardChasm</Text>
          <Text style={styles.title}>Your collection, within reach.</Text>
          <Text style={styles.copy}>
            Connect to your CardChasm server to access your collection, decks
            and tabletop. Your saved data stays on that server.
          </Text>
          <Text style={styles.label}>Server address</Text>
          <TextInput
            accessibilityLabel="CardChasm server address"
            style={styles.input}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            value={address}
            onChangeText={setAddress}
            onSubmitEditing={connect}
          />
          <Pressable
            accessibilityRole="button"
            style={styles.primary}
            onPress={connect}
          >
            <Text style={styles.primaryText}>Connect to CardChasm →</Text>
          </Pressable>
          {!!error && (
            <Text accessibilityRole="alert" style={styles.error}>
              {error}
            </Text>
          )}
          <Text style={styles.copy}>
            For local testing, run npm run mobile:backend on your computer. Use
            http://YOUR_COMPUTER_IP:3001 with both devices on the same trusted
            Wi-Fi. Use HTTPS for a hosted server.
          </Text>
        </View>
      </SafeAreaView>
    );
  if (Platform.OS === "web")
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.copy}>
          Open your connected CardChasm app in the browser.
        </Text>
        <Pressable
          style={styles.primary}
          accessibilityRole="link"
          onPress={() => Linking.openURL(url)}
        >
          <Text style={styles.primaryText}>Open CardChasm →</Text>
        </Pressable>
        <Pressable onPress={() => setUrl(null)}>
          <Text style={styles.copy}>Change server</Text>
        </Pressable>
      </SafeAreaView>
    );
  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <StatusBar style="light" />
      <View style={styles.toolbar}>
        <Text style={styles.logo}>◈ CardChasm</Text>
        <Pressable
          accessibilityRole="button"
          disabled={!loaded || picking}
          onPress={() => scan(true)}
        >
          <Text style={styles.action}>Camera</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          disabled={!loaded || picking}
          onPress={() => scan(false)}
        >
          <Text style={styles.action}>Photos</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            setLoaded(false);
            setUrl(null);
          }}
        >
          <Text style={styles.action}>Server</Text>
        </Pressable>
      </View>
      {!!error && (
        <View style={styles.errorBar}>
          <Text style={styles.error}>{error}</Text>
          <Pressable
            onPress={() => {
              setError("");
              web.current?.reload();
            }}
          >
            <Text style={styles.action}>Retry</Text>
          </Pressable>
        </View>
      )}
      <WebView
        ref={web}
        style={styles.web}
        source={{ uri: url }}
        originWhitelist={["http://*", "https://*"]}
        javaScriptEnabled
        domStorageEnabled
        sharedCookiesEnabled
        thirdPartyCookiesEnabled={false}
        allowsInlineMediaPlayback
        startInLoadingState
        renderLoading={() => (
          <ActivityIndicator color="#aebff0" style={styles.loading} />
        )}
        onLoadStart={() => setLoaded(false)}
        onLoad={() => setLoaded(true)}
        onError={() => {
          setLoaded(false);
          setError(
            "Connection lost. Check that the server is running and reachable.",
          );
        }}
        onHttpError={(e) => {
          if (e.nativeEvent.statusCode >= 400)
            setError(`Server returned ${e.nativeEvent.statusCode}.`);
        }}
        onNavigationStateChange={(state) => setCanGoBack(state.canGoBack)}
        onMessage={(event) => {
          if (new URL(event.nativeEvent.url).origin === url)
            void share(event.nativeEvent.data);
        }}
        onShouldStartLoadWithRequest={(request) => {
          if (request.url === "about:blank") return true;
          try {
            const target = new URL(request.url);
            if (target.origin === url) return true;
            if (target.protocol === "https:" && request.isTopFrame !== false)
              void Linking.openURL(request.url);
            return false;
          } catch {
            return false;
          }
        }}
      />
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0b0b0d" },
  setup: { padding: 28, gap: 18, flex: 1, justifyContent: "center" },
  brand: { fontSize: 25, fontWeight: "500", color: "#aebff0" },
  title: {
    fontSize: 34,
    fontWeight: "600",
    fontFamily: undefined,
    color: "#f1f1f5",
  },
  copy: { fontSize: 14, lineHeight: 23, color: "#a7a7b2" },
  label: { fontSize: 12, color: "#b7b7c2" },
  input: {
    borderWidth: 1,
    borderColor: "#393941",
    borderRadius: 9,
    color: "#f1f1f5",
    padding: 14,
    backgroundColor: "#18181b",
  },
  primary: {
    backgroundColor: "#9bbcf3",
    borderRadius: 9,
    padding: 16,
    alignItems: "center",
  },
  primaryText: { fontWeight: "700", color: "#101725" },
  error: { color: "#edaaa9", fontSize: 13, lineHeight: 20 },
  toolbar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 15,
    padding: 13,
    backgroundColor: "#111113",
  },
  logo: { color: "#e5e5eb", fontWeight: "700", flex: 1, fontSize: 16 },
  action: { color: "#aebff0", fontSize: 12, paddingVertical: 7 },
  web: { flex: 1, backgroundColor: "#0b0b0d" },
  loading: { position: "absolute", top: "45%", left: "48%" },
  errorBar: { padding: 12, backgroundColor: "#29232a" },
});
