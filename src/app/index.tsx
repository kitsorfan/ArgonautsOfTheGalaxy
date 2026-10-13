import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Device from 'expo-device';
import * as Haptics from 'expo-haptics';
import * as Linking from 'expo-linking';
import { useKeepAwake } from 'expo-keep-awake';
import * as NavigationBar from 'expo-navigation-bar';
import * as ScreenOrientation from 'expo-screen-orientation';
import * as SplashScreen from 'expo-splash-screen';
import * as StoreReview from 'expo-store-review';
import { useEffect, useRef, useState } from 'react';
import { AppState, BackHandler, Platform, StyleSheet, View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';

import html from '@/generated/gameHtml';
import { Music } from '@/music';

import type { DeviceInfo } from '../../game/src/core/graphics';
import type { MusicFile } from '../../game/src/core/music';

/** Named after the game's old title; kept so existing saves carry over. */
const SAVE_KEY = 'leviathan3d.save.v1';

SplashScreen.preventAutoHideAsync().catch(() => {});

/** What the game's Auto graphics needs to know about this phone (the page can't see its memory or age itself). */
const DEVICE: DeviceInfo = { memory: Device.totalMemory, year: Device.deviceYearClass, model: Device.modelName, os: Platform.OS };

type GameMessage =
  | { type: 'save'; data: string }
  | { type: 'haptic'; kind: 'light' | 'medium' | 'heavy' | 'success' | 'warning' }
  | { type: 'exit' }
  | { type: 'review' }
  | { type: 'link'; url: string }
  | { type: 'music'; file: MusicFile | null; volume: number }
  | { type: 'musicVolume'; volume: number }
  | { type: 'error'; message: string };

function haptic(kind: Extract<GameMessage, { type: 'haptic' }>['kind']) {
  switch (kind) {
    case 'light':
      return Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    case 'medium':
      return Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    case 'heavy':
      return Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    case 'success':
      return Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    case 'warning':
      return Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  }
}

/** Hosts the three.js game (a self-contained HTML page) full screen in a WebView. */
export default function Game() {
  useKeepAwake();
  const web = useRef<WebView>(null);
  const music = useRef<Music | null>(null);
  // undefined while loading; null when there is no save yet.
  const [save, setSave] = useState<string | null | undefined>(undefined);
  // Bumped to start the page over from scratch after its process dies.
  const [run, setRun] = useState(0);

  // The system kills the WebView's page process when memory runs short (a big three.js scene on a
  // small phone, often while the app is in the background), leaving a dead black view. Start the
  // page again with the latest save; it boots back to the title screen.
  const restart = () => {
    music.current?.play(null, 0);
    AsyncStorage.getItem(SAVE_KEY)
      .catch(() => null)
      .then((raw) => {
        setSave(raw);
        setRun((n) => n + 1);
      });
  };

  useEffect(() => {
    AsyncStorage.getItem(SAVE_KEY)
      .then((raw) => setSave(raw))
      .catch(() => setSave(null));
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE).catch(() => {});
    if (Platform.OS === 'android') NavigationBar.setVisibilityAsync('hidden').catch(() => {});
    // Never leave the splash up if the page is slow to report in.
    const t = setTimeout(() => SplashScreen.hideAsync().catch(() => {}), 6000);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const m = new Music();
    music.current = m;
    return () => {
      m.release();
      music.current = null;
    };
  }, []);

  useEffect(() => {
    const back = BackHandler.addEventListener('hardwareBackPress', () => {
      web.current?.injectJavaScript('window.__onBack && window.__onBack(); true;');
      return true;
    });
    const app = AppState.addEventListener('change', (state) => {
      music.current?.setActive(state === 'active');
      if (state !== 'active') web.current?.injectJavaScript('window.__onPause && window.__onPause(); true;');
      else if (Platform.OS === 'android') NavigationBar.setVisibilityAsync('hidden').catch(() => {});
    });
    return () => {
      back.remove();
      app.remove();
    };
  }, []);

  const onMessage = (e: WebViewMessageEvent) => {
    let msg: GameMessage;
    try {
      msg = JSON.parse(e.nativeEvent.data) as GameMessage;
    } catch {
      return;
    }
    switch (msg.type) {
      case 'save':
        (msg.data ? AsyncStorage.setItem(SAVE_KEY, msg.data) : AsyncStorage.removeItem(SAVE_KEY)).catch(() => {});
        break;
      case 'haptic':
        haptic(msg.kind)?.catch(() => {});
        break;
      case 'exit':
        BackHandler.exitApp();
        break;
      case 'review':
        // Only the in-app card: on phones without it, requestReview would open the store and leave the game.
        // Google Play decides whether the card really shows (it has a quota) and never tells the app.
        StoreReview.isAvailableAsync()
          .then((ok) => (ok ? StoreReview.requestReview() : undefined))
          .catch(() => {});
        break;
      case 'link':
        // Only web pages and emails (the About screen's links), never anything else the page might ask for.
        if (/^(https:\/\/|mailto:)/.test(msg.url)) Linking.openURL(msg.url).catch(() => {});
        break;
      case 'music':
        music.current?.play(msg.file, msg.volume);
        break;
      case 'musicVolume':
        music.current?.setVolume(msg.volume);
        break;
      case 'error':
        console.warn('[game]', msg.message);
        break;
    }
  };

  if (save === undefined) return <View style={styles.root} />;

  return (
    <View style={styles.root}>
      <WebView
        key={run}
        ref={web}
        style={styles.web}
        source={{ html }}
        originWhitelist={['*']}
        injectedJavaScriptBeforeContentLoaded={`window.__SAVE__ = ${JSON.stringify(save ?? '')}; window.__DEVICE__ = ${JSON.stringify(DEVICE)}; true;`}
        onMessage={onMessage}
        onLoadEnd={() => SplashScreen.hideAsync().catch(() => {})}
        onRenderProcessGone={restart}
        onContentProcessDidTerminate={restart}
        javaScriptEnabled
        domStorageEnabled
        mediaPlaybackRequiresUserAction={false}
        allowsInlineMediaPlayback
        scrollEnabled={false}
        bounces={false}
        overScrollMode="never"
        // The game lays out its menus for the screen; Android's font size setting would push them off it.
        textZoom={100}
        setSupportMultipleWindows={false}
        androidLayerType="hardware"
        webviewDebuggingEnabled={__DEV__}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#03040a' },
  web: { flex: 1, backgroundColor: '#03040a' },
});
