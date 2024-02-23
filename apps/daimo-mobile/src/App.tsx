import { now } from "@daimo/common";
import BottomSheet, { BottomSheetBackdrop } from "@gorhom/bottom-sheet";
import { BottomSheetDefaultBackdropProps } from "@gorhom/bottom-sheet/lib/typescript/components/bottomSheetBackdrop/types";
import { DefaultTheme, NavigationContainer } from "@react-navigation/native";
import { useFonts } from "expo-font";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { StyleSheet, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import RNShake from "react-native-shake";

import { Dispatcher, DispatcherContext } from "./action/dispatch";
import { useInitNotifications } from "./logic/notify";
import { RpcProvider } from "./logic/trpc";
import { useAccount } from "./model/account";
import { TabNav } from "./view/TabNav";
import { renderErrorFallback } from "./view/screen/ErrorScreen";
import ScrollPellet from "./view/shared/ScrollPellet";
import { color } from "./view/shared/style";
import { DebugBottomSheet } from "./view/sheet/DebugBottomSheet";
import { FarcasterBottomSheet } from "./view/sheet/FarcasterBottomSheet";

SplashScreen.preventAutoHideAsync();

export default function App() {
  console.log("[APP] rendering");
  const [account] = useAccount();

  // Display notifications, listen for push notifications
  useInitNotifications();

  // Load font to fix icons on Android
  useFonts({ Octicons: require("../assets/octicons.ttf") });

  // White background to avoid between-tab flicker
  let theme = DefaultTheme;
  theme = { ...theme, colors: { ...theme.colors, background: color.white } };

  useEffect(() => {
    const nowS = now();
    if (account == null || nowS - account.lastBlockTimestamp < 60 * 10) {
      SplashScreen.hideAsync();
    }
  }, []);

  return (
    <RpcProvider>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <NavigationContainer theme={theme}>
          <AppBody />
        </NavigationContainer>
      </GestureHandlerRootView>
    </RpcProvider>
  );
}

const globalBottomSheetHeights = {
  debug: "33%",
  connectFarcaster: "66%",
} as const;

type GlobalBottomSheet = null | keyof typeof globalBottomSheetHeights;

function AppBody() {
  // Global dispatcher
  const dispatcher = useMemo(() => new Dispatcher(), []);

  // Global bottom sheet
  const bottomSheetRef = useRef<BottomSheet>(null);
  const [bottomSheet, setBottomSheet] = useState<GlobalBottomSheet>(null);
  const snapPoints = useMemo(
    () => (bottomSheet ? [globalBottomSheetHeights[bottomSheet]] : ["10%"]),
    [bottomSheet]
  );

  // Global shake gesture > open Send Debug Log sheet
  useEffect(() => {
    const subscription = RNShake.addListener(() => setBottomSheet("debug"));
    return () => subscription.remove();
  }, []);

  // Open bottom sheet when requested
  useEffect(() => {
    console.log(`[APP] bottomSheet=${bottomSheet}`);
    if (bottomSheet) bottomSheetRef.current?.expand();
    else bottomSheetRef.current?.close();
  }, [bottomSheet]);

  // Close bottom sheet when user swipes it away
  const onChangeIndex = useCallback((index: number) => {
    if (index < 0) setBottomSheet(null);
  }, []);

  // Dark backdrop for bottom sheet
  const renderBackdrop = useCallback(
    (props: BottomSheetDefaultBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-0.9}
        appearsOnIndex={0}
        pressBehavior="close"
      />
    ),
    []
  );

  // Handle dispatch > open bottom sheet
  const openFC = () => setBottomSheet("connectFarcaster");
  useEffect(() => dispatcher.register("connectFarcaster", openFC), []);
  const hideSheet = () => setBottomSheet(null);
  useEffect(() => dispatcher.register("hideBottomSheet", hideSheet), []);

  return (
    <DispatcherContext.Provider value={dispatcher}>
      <ErrorBoundary fallbackRender={renderErrorFallback}>
        <SafeAreaProvider>
          <TabNav />
          <StatusBar style="auto" />
          <View
            style={styles.bottomSheetWrapper}
            pointerEvents={bottomSheet != null ? "auto" : "none"}
          >
            <BottomSheet
              handleComponent={ScrollPellet}
              backdropComponent={renderBackdrop}
              ref={bottomSheetRef}
              index={-1}
              snapPoints={snapPoints}
              onChange={onChangeIndex}
              enablePanDownToClose
            >
              {bottomSheet === "debug" && <DebugBottomSheet />}
              {bottomSheet === "connectFarcaster" && <FarcasterBottomSheet />}
            </BottomSheet>
          </View>
        </SafeAreaProvider>
      </ErrorBoundary>
    </DispatcherContext.Provider>
  );
}

const styles = StyleSheet.create({
  bottomSheetWrapper: {
    position: "absolute",
    height: "100%",
    width: "100%",
    alignItems: "center",
  },
});
