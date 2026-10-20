import { guestSnapshot, planRecoverySnapshot, readRecoverySlots, exportRecovery } from "../shared/guestRecovery";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
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
import Constants from "expo-constants";
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

function initialServerAddress() {
  if (process.env.EXPO_PUBLIC_STACKSYNERGY_URL) return process.env.EXPO_PUBLIC_STACKSYNERGY_URL;
  if (process.env.EXPO_PUBLIC_CARDCHASM_URL)
    return process.env.EXPO_PUBLIC_CARDCHASM_URL;
  if (Platform.OS !== "web") {
    try {
      const saved = new File(Paths.document, "cardchasm-server.txt");
      if (saved.exists) return serverOrigin(saved.textSync());
    } catch {
      /* Use the development address or manual setup. */
    }
  }
  const host = __DEV__
    ? Constants.expoConfig?.hostUri?.split(":")[0]
    : undefined;
  return host ? `http://${host}:3001` : "";
}
export default function StackSynergyMobile() {
  const [initialAddress] = useState(initialServerAddress);
  const [address, setAddress] = useState(initialAddress);
  const [connecting, setConnecting] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [canGoBack, setCanGoBack] = useState(false);
  const [picking, setPicking] = useState(false);
  const [recovering, setRecovering] = useState(false);
  const [recoveryNotice,setRecoveryNotice] = useState("");
  function recoverySlots() {
    return ["cardchasm-guest-recovery-a.json","cardchasm-guest-recovery-b.json"].map(name=>new File(Paths.document,name));
  }
  function captureRecovery(raw:string,origin:string) {
    const documents=guestSnapshot(raw);if(!documents)throw Error("Invalid guest recovery snapshot.");
    const files=recoverySlots();const plan=planRecoverySnapshot(files.map(file=>file.exists?file.textSync():null),origin,documents,new Date().toISOString());
    if(plan){const file=files[plan.index];file.create({overwrite:true});file.write(plan.text);if(file.textSync()!==plan.text)throw Error("Recovery write could not be verified.");}
    setRecoveryNotice(documents.length?"Guest recovery saved on this device. Export for a separate backup.":"");
  }
  async function exportGuestRecovery() {
    setRecovering(true);
    try {
      const {vault}=readRecoverySlots(recoverySlots().map(file=>file.exists?file.textSync():null));
      const backup=exportRecovery(vault);
      if(!backup.documents.length)throw Error("No guest snapshots captured yet. Open the original server address with your guest library, then try again. Older app versions did not capture recovery copies.");
      if(!(await Sharing.isAvailableAsync()))throw Error("Sharing is unavailable on this device.");
      const file=new File(Paths.cache,"cardchasm-native-guest-recovery.json");file.create({overwrite:true});file.write(JSON.stringify(backup,null,2));
      await Sharing.shareAsync(file.uri,{mimeType:"application/json",dialogTitle:"Save guest recovery JSON, then import as new guest copies"});
    } catch(e) { Alert.alert("Guest recovery unavailable",(e as Error).message); }
    finally {setRecovering(false);}
  }
  function offerGuestRecovery() {
    Alert.alert("Export guest recovery", "This exports captured local guest snapshots from this app project, including prior server addresses and trash. No account documents are included. Save the JSON file, connect to the new server, then Settings → Import library JSON as new guest copies. Nothing is merged automatically; duplicate copies may appear. This does not restore login or playtest sessions.",[{text:"Cancel",style:"cancel"},{text:"Export JSON",onPress:()=>void exportGuestRecovery()}]);
  }
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
  const connectTo = useCallback(async (address: string) => {
    setConnecting(true);
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
        throw Error("This address is not a StackSynergy server.");
      try {
        const saved = new File(Paths.document, "cardchasm-server.txt");
        saved.create({ overwrite: true });
        saved.write(origin);
      } catch {
        /* A storage failure must not block the current connection. */
      }
      // onLoadStart handles real navigation. Fast Refresh may reconnect to the SAME
      // URI, which does not trigger another load event; do not strand native tools disabled.
      setUrl(origin);
      web.current?.injectJavaScript(`if (window.location.origin === ${JSON.stringify(origin)} && document.getElementById('root')?.childElementCount) { window.ReactNativeWebView.postMessage(JSON.stringify({type:'cardchasm:ready'})); } true;`);
    } catch (e) {
      setError(
        `${(e as Error).message} On a phone use your computer’s Wi-Fi address, not localhost.`,
      );
    } finally {
      setConnecting(false);
    }
  }, []);
  useEffect(() => {
    if (!initialAddress) return;
    const timer = setTimeout(() => {
      void connectTo(initialAddress);
    }, 0);
    return () => clearTimeout(timer);
  }, [connectTo, initialAddress]);
  function connect() {
    void connectTo(address);
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
        dialogTitle: "Export from StackSynergy",
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
          <View style={{flexDirection:"row",alignItems:"center",gap:10}}><Image source={require("./assets/icon.png")} style={{width:44,height:44,borderRadius:8}}/><Text style={styles.brand}>StackSynergy</Text></View>
          <Text style={styles.title}>Your collection, within reach.</Text>
          <Text style={styles.copy}>
            Connect to your StackSynergy server to access your collection, decks
            and tabletop. Your saved data stays on that server.
          </Text>
          <Pressable accessibilityRole="button" disabled={recovering} onPress={offerGuestRecovery}><Text style={styles.action}>Export guest recovery</Text></Pressable>
          <Text style={styles.copy}>Guest browser storage belongs to its server address. Recovery can export snapshots captured by this app version; it never moves them into another server automatically.</Text>
          <Text style={styles.label}>Server address</Text>
          <TextInput
            accessibilityLabel="StackSynergy server address"
            style={styles.input}
            autoCapitalize="none"
            autoCorrect={false}
            spellCheck={false}
            autoComplete="off"
            keyboardType="url"
            value={address}
            onChangeText={setAddress}
            onSubmitEditing={connect}
          />
          <Pressable
            accessibilityRole="button"
            style={styles.primary}
            onPress={connect}
            disabled={connecting}
          >
            <Text style={styles.primaryText}>
              {connecting ? "Connecting…" : "Connect to StackSynergy →"}
            </Text>
          </Pressable>
          {!!error && (
            <Text accessibilityRole="alert" style={styles.error}>
              {error}
            </Text>
          )}
          <Text style={styles.copy}>
            For local testing, run npm run dev:all on your computer. Use
            http://YOUR_COMPUTER_IP:5173 with both devices on the same trusted
            Wi-Fi. Use HTTPS for a hosted server.
          </Text>
        </View>
      </SafeAreaView>
    );
  if (Platform.OS === "web")
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.copy}>
          Open your connected StackSynergy app in the browser.
        </Text>
        <Pressable
          style={styles.primary}
          accessibilityRole="link"
          onPress={() => Linking.openURL(url)}
        >
          <Text style={styles.primaryText}>Open StackSynergy →</Text>
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
        <View style={{flexDirection:"row",alignItems:"center",gap:8}}><Image source={require("./assets/icon.png")} style={{width:32,height:32,borderRadius:6}}/><Text style={styles.logo}>StackSynergy</Text></View>
        <Pressable accessibilityRole="button" disabled={recovering} onPress={offerGuestRecovery}><Text style={styles.action}>Recovery</Text></Pressable>
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
      {!!recoveryNotice&&<Text style={styles.recoveryNotice}>{recoveryNotice}</Text>}
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
        hideKeyboardAccessoryView
        injectedJavaScriptBeforeContentLoaded={`
          window.addEventListener('error', function(event) {
            window.ReactNativeWebView.postMessage(JSON.stringify({type:'cardchasm:page-error', message: String(event.message || 'Page error')}));
          });
          window.addEventListener('unhandledrejection', function(event) {
            window.ReactNativeWebView.postMessage(JSON.stringify({type:'cardchasm:page-error', message: String(event.reason?.message || event.reason || 'Page error')}));
          });
          true;
        `}
        domStorageEnabled
        sharedCookiesEnabled
        thirdPartyCookiesEnabled={false}
        allowsInlineMediaPlayback
        startInLoadingState
        renderLoading={() => (
          <ActivityIndicator color="#aebff0" style={styles.loading} />
        )}
        onLoadStart={() => {
          setLoaded(false);
          setError("");
        }}
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
          if (new URL(event.nativeEvent.url).origin !== url) return;
          try {
            const message = JSON.parse(event.nativeEvent.data);
            if(message.type==="cardchasm:guest-snapshot"){
              try{captureRecovery(event.nativeEvent.data,url);}catch{setRecoveryNotice("Guest recovery copy could not be saved. Browser data was not changed; export your guest library from Settings.");}
              return;
            }
            if (message.type === "cardchasm:ready") {
              setRecoveryNotice(current=>current.startsWith("Guest recovery keeps prior")?"":current);
              setError("");
              setLoaded(true);
              return;
            }
            if (message.type === "cardchasm:page-error") {
              setError(
                "StackSynergy could not open: " +
                  String(message.message).slice(0, 300),
              );
              return;
            }
          } catch {
            return;
          }
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
  container: { flex: 1, backgroundColor: "#0c0d0f" },
  setup: { padding: 28, gap: 18, flex: 1, justifyContent: "center" },
  brand: { fontSize: 25, fontWeight: "500", color: "#f3b84b" },
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
    backgroundColor: "#f3b84b",
    borderRadius: 9,
    padding: 16,
    alignItems: "center",
  },
  primaryText: { fontWeight: "700", color: "#0c0d0f" },
  error: { color: "#edaaa9", fontSize: 13, lineHeight: 20 },
  toolbar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 15,
    padding: 13,
    backgroundColor: "#0c0d0f",
  },
  recoveryNotice: {color:"#a7a7b2",fontSize:11,paddingHorizontal:12,paddingBottom:6},
  logo: { color: "#e5e5eb", fontWeight: "700", flex: 1, fontSize: 16 },
  action: { color: "#f3b84b", fontSize: 12, paddingVertical: 7 },
  web: { flex: 1, backgroundColor: "#101113" },
  loading: { position: "absolute", top: "45%", left: "48%" },
  errorBar: { padding: 12, backgroundColor: "#29232a" },
});
