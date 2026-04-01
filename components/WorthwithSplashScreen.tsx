import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Easing,
  Pressable,
  Platform,
} from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';

/** Load via Expo: @expo-google-fonts/syne (Syne_800ExtraBold) and @expo-google-fonts/dm-mono (DMMono_400Regular) */
const FONT_WORDMARK = 'Syne_800ExtraBold';
const FONT_MONO = 'DMMono_400Regular';

const BG = '#1A1A2E';
const PURPLE = '#7C3AED';
const ORANGE = '#F97316';

const LOGO_PATH =
  'M 105 310 C 105 310,118 340,148 330 C 178 320,188 240,218 245 C 248 250,252 310,282 295 C 312 280,340 190,400 148';

const easeOut = Easing.out(Easing.cubic);

function WorthwithLogo() {
  return (
    <Svg width={100} height={100} viewBox="0 0 500 500">
      <Path
        d={LOGO_PATH}
        stroke="#FFFFFF"
        strokeWidth={30}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <Circle cx={152} cy={342} r={36} fill={PURPLE} />
      <Circle cx={284} cy={306} r={36} fill={ORANGE} />
    </Svg>
  );
}

function Wordmark() {
  const word = 'worthwith';
  return (
    <Text style={styles.wordmarkBase}>
      {word.split('').map((char, i) => {
        let color: string = '#FFFFFF';
        if (char === 'o') color = PURPLE;
        if (char === 'i') color = ORANGE;
        return (
          <Text key={`${char}-${i}`} style={{ color }}>
            {char}
          </Text>
        );
      })}
    </Text>
  );
}

export type WorthwithSplashScreenProps = {
  onStartPress?: () => void;
};

export function WorthwithSplashScreen({ onStartPress }: WorthwithSplashScreenProps) {
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const logoY = useRef(new Animated.Value(18)).current;
  const wordOpacity = useRef(new Animated.Value(0)).current;
  const wordY = useRef(new Animated.Value(18)).current;
  const tagOpacity = useRef(new Animated.Value(0)).current;
  const tagY = useRef(new Animated.Value(18)).current;
  const btnOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const anim = (
      opacity: Animated.Value,
      translateY: Animated.Value,
      delay: number
    ) =>
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 700,
          delay,
          easing: easeOut,
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: 0,
          duration: 700,
          delay,
          easing: easeOut,
          useNativeDriver: true,
        }),
      ]);

    Animated.parallel([
      anim(logoOpacity, logoY, 0),
      anim(wordOpacity, wordY, 150),
      anim(tagOpacity, tagY, 280),
      Animated.timing(btnOpacity, {
        toValue: 1,
        duration: 700,
        delay: 420,
        easing: easeOut,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  return (
    <View style={styles.root}>
      <View style={styles.centerColumn}>
        <Animated.View
          style={{
            opacity: logoOpacity,
            transform: [{ translateY: logoY }],
          }}
        >
          <WorthwithLogo />
        </Animated.View>

        <Animated.View
          style={[
            styles.wordmarkWrap,
            { opacity: wordOpacity, transform: [{ translateY: wordY }] },
          ]}
        >
          <Wordmark />
        </Animated.View>

        <Animated.Text
          style={[
            styles.tagline,
            { opacity: tagOpacity, transform: [{ translateY: tagY }] },
          ]}
        >
          같이, 가치있게
        </Animated.Text>
      </View>

      <Animated.View style={[styles.ctaWrap, { opacity: btnOpacity }]}>
        <Pressable
          onPress={onStartPress}
          style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}
        >
          <Text style={styles.ctaText}>시작하기</Text>
        </Pressable>
      </Animated.View>

      <View style={styles.homeIndicatorRow} pointerEvents="none">
        <View style={styles.homeIndicatorBar} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: BG,
    borderWidth: 0,
  },
  centerColumn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'column',
  },
  wordmarkWrap: {
    marginTop: 20,
  },
  wordmarkBase: {
    fontFamily: FONT_WORDMARK,
    fontSize: 28,
    letterSpacing: -0.5,
    color: '#FFFFFF',
    fontWeight: Platform.OS === 'android' ? '800' : undefined,
  },
  tagline: {
    marginTop: 10,
    fontFamily: FONT_MONO,
    fontSize: 11,
    letterSpacing: 4,
    color: 'rgba(255,255,255,0.3)',
    fontWeight: Platform.OS === 'android' ? '400' : undefined,
  },
  ctaWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 56,
    alignItems: 'center',
  },
  cta: {
    backgroundColor: PURPLE,
    borderRadius: 50,
    paddingVertical: 14,
    paddingHorizontal: 52,
  },
  ctaPressed: {
    opacity: 0.92,
  },
  ctaText: {
    fontFamily: FONT_MONO,
    color: '#FFFFFF',
    fontSize: 12,
    letterSpacing: 1.5,
    fontWeight: Platform.OS === 'android' ? '400' : undefined,
  },
  homeIndicatorRow: {
    position: 'absolute',
    bottom: 10,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  homeIndicatorBar: {
    width: 100,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
});
